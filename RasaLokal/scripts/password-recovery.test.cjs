const assert = require('node:assert/strict');
const { test } = require('node:test');
const { INVALID_RECOVERY_MESSAGE, parseRecoveryLink, recoveryRedirectUrl, recoveryErrorMessage, requestPasswordReset, restoreRecoverySession, updateRecoveredPassword } = require('../src/lib/passwordRecovery.ts');

const identity = { userId: 'recovered-user', email: 'user@example.com' };
const sessionResponse = { data: { session: { user: { id: identity.userId, email: identity.email } } }, error: null };

test('home redirects keep email credentials in the fragment and preserve PKCE query parameters', () => {
  const fragment = 'access_token=access&refresh_token=refresh&type=recovery';
  const url = new URL(recoveryRedirectUrl({ '#': fragment }), 'http://localhost:8081');
  assert.equal(url.pathname, '/reset-password');
  assert.equal(url.hash, '#' + fragment);
  assert.equal(url.searchParams.has('access_token'), false);
  const pkce = new URL(recoveryRedirectUrl({ code: 'test-code', sb_flow_id: 'flow-id' }), 'http://localhost:8081');
  assert.equal(pkce.searchParams.get('code'), 'test-code');
  assert.equal(pkce.searchParams.get('sb_flow_id'), 'flow-id');
});

test('reads recovery tokens from Supabase email fragments', () => {
  assert.deepEqual(parseRecoveryLink({ '#': 'access_token=access&refresh_token=refresh&type=recovery' }), {
    kind: 'tokens', accessToken: 'access', refreshToken: 'refresh',
  });
  assert.equal(parseRecoveryLink({ '#': 'type=signup&access_token=access&refresh_token=refresh' }).kind, 'none');
});

test('handles query parameters, custom templates, and PKCE flow IDs', () => {
  assert.deepEqual(parseRecoveryLink({ type: 'recovery', token_hash: 'hash' }), { kind: 'tokenHash', tokenHash: 'hash' });
  assert.deepEqual(parseRecoveryLink({ code: 'code', sb_flow_id: 'flow' }), { kind: 'code', code: 'code', flowId: 'flow' });
  assert.equal(parseRecoveryLink({ email: 'user@example.com' }).kind, 'none');
});

test('expired, missing, and partial credentials never reuse an existing session', async () => {
  for (const params of [{ '#': 'error=access_denied&error_code=otp_expired' }, { type: 'recovery' }, { type: 'recovery', access_token: 'access' }, {}]) {
    await assert.rejects(restoreRecoverySession({}, parseRecoveryLink(params)), { message: INVALID_RECOVERY_MESSAGE });
  }
});

test('requests an email with the normalized address and exact app redirect', async () => {
  let received;
  await requestPasswordReset({ resetPasswordForEmail: async (...args) => { received = args; return { error: null }; } }, ' User@Example.com ', 'http://localhost:8081/reset-password');
  assert.deepEqual(received, ['user@example.com', { redirectTo: 'http://localhost:8081/reset-password' }]);
});

test('invalid email input is rejected before making a recovery request', async () => {
  await assert.rejects(requestPasswordReset({}, 'invalid', 'http://localhost:8081/reset-password'), /email yang valid/);
  await assert.rejects(requestPasswordReset({}, 'user@example.com', ''), /Muat ulang/);
});

test('a successful request does not depend on an account-existence response', async () => {
  await requestPasswordReset({ resetPasswordForEmail: async () => ({ data: {}, error: null }) }, 'unknown@example.com', 'http://localhost:8081/reset-password');
});

test('restores and validates the emailed session before returning its identity', async () => {
  let received;
  const result = await restoreRecoverySession({ setSession: async (tokens) => { received = tokens; return sessionResponse; } }, { kind: 'tokens', accessToken: 'access', refreshToken: 'refresh' });
  assert.deepEqual(received, { access_token: 'access', refresh_token: 'refresh' });
  assert.deepEqual(result, identity);
  await assert.rejects(restoreRecoverySession({ setSession: async () => ({ data: { session: null }, error: null }) }, { kind: 'tokens', accessToken: 'access', refreshToken: 'refresh' }), { message: INVALID_RECOVERY_MESSAGE });
});

test('verifies custom token hashes specifically as password recovery', async () => {
  let received;
  await restoreRecoverySession({ verifyOtp: async (options) => { received = options; return sessionResponse; } }, { kind: 'tokenHash', tokenHash: 'hash' });
  assert.deepEqual(received, { token_hash: 'hash', type: 'recovery' });
});

test('exchanges PKCE codes with their matching flow ID', async () => {
  let received;
  await restoreRecoverySession({ exchangeCodeForSession: async (...args) => { received = args; return sessionResponse; } }, { kind: 'code', code: 'code', flowId: 'flow' });
  assert.deepEqual(received, ['code', { flowId: 'flow' }]);
});

test('rejects invalid passwords before checking or changing the account', async () => {
  await assert.rejects(updateRecoveredPassword({}, identity, 'short', 'short'), /minimal 8/);
  await assert.rejects(updateRecoveredPassword({}, identity, 'long-password', 'different-password'), /tidak cocok/);
});

test('a session switched in another tab cannot change the wrong account password', async () => {
  await assert.rejects(updateRecoveredPassword({ getUser: async () => ({ data: { user: { id: 'other-user' } }, error: null }) }, identity, 'new-password', 'new-password'), { message: INVALID_RECOVERY_MESSAGE });
});

test('updates the verified account without trimming its new password', async () => {
  let received;
  await updateRecoveredPassword({
    getUser: async () => ({ data: { user: { id: identity.userId } }, error: null }),
    updateUser: async (options) => { received = options; return { error: null }; },
  }, identity, ' new-password ', ' new-password ');
  assert.deepEqual(received, { password: ' new-password ' });
});

test('preserves server errors so a failed save is never treated as success', async () => {
  const serverError = Object.assign(new Error('Password should be different'), { code: 'same_password' });
  await assert.rejects(updateRecoveredPassword({
    getUser: async () => ({ data: { user: { id: identity.userId } }, error: null }),
    updateUser: async () => ({ error: serverError }),
  }, identity, 'new-password', 'new-password'), (error) => error === serverError);
  assert.match(recoveryErrorMessage(serverError), /berbeda/);
  assert.match(recoveryErrorMessage({ code: 'over_email_send_rate_limit' }), /Terlalu banyak/);
  assert.equal(recoveryErrorMessage({ code: 'otp_expired' }), INVALID_RECOVERY_MESSAGE);
  assert.match(recoveryErrorMessage(new TypeError('Failed to fetch')), /koneksi internet/);
});
