import type { SupabaseClient } from '@supabase/supabase-js';

export type RecoveryParameters = Record<string, string | string[] | undefined>;
export type RecoveryLink =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'code'; code: string; flowId?: string }
  | { kind: 'tokenHash'; tokenHash: string };
export type RecoveryIdentity = { userId: string; email: string };

type RecoveryAuth = Pick<SupabaseClient['auth'],
  'resetPasswordForEmail' | 'setSession' | 'exchangeCodeForSession' | 'verifyOtp' | 'getUser' | 'updateUser'>;

export const INVALID_RECOVERY_MESSAGE = 'Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru dan buka email yang paling baru.';

export function recoveryRedirectUrl(params: RecoveryParameters): `/reset-password?${string}` {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === '#' || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const fragment = Array.isArray(params['#']) ? params['#'][0] : params['#'];
  // Preserve a real URL fragment: passing '#' as an href-object query key corrupts the link.
  return `/reset-password?${query.toString()}${fragment ? `#${fragment}` : ''}`;
}

export function parseRecoveryLink(params: RecoveryParameters): RecoveryLink {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const fragment = new URLSearchParams((first(params['#']) ?? '').replace(/^#/, ''));
  const get = (key: string) => fragment.get(key) ?? first(params[key]);
  const type = get('type');

  // Signup confirmations and ordinary sign-in links must not enable password recovery.
  if (type && type !== 'recovery') return { kind: 'none' };
  if (get('error') || get('error_code') || get('error_description')) return { kind: 'invalid' };

  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  const code = get('code');
  const tokenHash = get('token_hash');
  if (type === 'recovery' && accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken };
  if (type === 'recovery' && tokenHash) return { kind: 'tokenHash', tokenHash };
  if (code) return { kind: 'code', code, flowId: get('sb_flow_id') || undefined };
  if (type === 'recovery' || accessToken || refreshToken || tokenHash) return { kind: 'invalid' };
  return { kind: 'none' };
}

export async function requestPasswordReset(auth: RecoveryAuth, email: string, redirectTo: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Masukkan alamat email yang valid.');
  }
  if (!redirectTo) throw new Error('Halaman pemulihan belum dapat dibuka. Muat ulang aplikasi lalu coba lagi.');
  const { error } = await auth.resetPasswordForEmail(cleanEmail, { redirectTo });
  if (error) throw error;
}

export async function restoreRecoverySession(auth: RecoveryAuth, link: RecoveryLink): Promise<RecoveryIdentity> {
  if (link.kind === 'none' || link.kind === 'invalid') throw new Error(INVALID_RECOVERY_MESSAGE);
  const { data, error } = link.kind === 'tokens'
    ? await auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
    : link.kind === 'tokenHash'
      ? await auth.verifyOtp({ token_hash: link.tokenHash, type: 'recovery' })
      : await auth.exchangeCodeForSession(link.code, link.flowId ? { flowId: link.flowId } : undefined);
  if (error) throw error;
  if (!data.session?.user) throw new Error(INVALID_RECOVERY_MESSAGE);
  return { userId: data.session.user.id, email: data.session.user.email ?? '' };
}

export async function updateRecoveredPassword(auth: RecoveryAuth, identity: RecoveryIdentity, password: string, confirmation: string): Promise<void> {
  if (password.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
  if (password !== confirmation) throw new Error('Konfirmasi kata sandi tidak cocok.');

  // Another browser tab may have changed the signed-in account since the email was opened.
  const { data, error } = await auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== identity.userId) throw new Error(INVALID_RECOVERY_MESSAGE);
  const { error: updateError } = await auth.updateUser({ password });
  if (updateError) throw updateError;
}

export function recoveryErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'Terlalu banyak permintaan. Tunggu beberapa saat sebelum meminta email reset lagi.';
  }
  if (code === 'same_password') return 'Gunakan kata sandi yang berbeda dari kata sandi sebelumnya.';
  if (code === 'weak_password') return 'Kata sandi belum memenuhi persyaratan keamanan. Gunakan kata sandi yang lebih kuat.';
  if (code === 'otp_expired' || code === 'session_not_found' || code === 'refresh_token_not_found' || code === 'refresh_token_already_used' || code === 'flow_state_expired' || code === 'flow_state_not_found' || code === 'bad_code_verifier' || code === 'bad_jwt') {
    return INVALID_RECOVERY_MESSAGE;
  }
  if (error instanceof Error && error.name === 'AuthSessionMissingError') return INVALID_RECOVERY_MESSAGE;
  if (error instanceof Error && (error.name === 'AuthRetryableFetchError' || /failed to fetch|network request failed|fetch failed/i.test(error.message))) {
    return 'Tidak dapat terhubung. Periksa koneksi internet lalu coba lagi.';
  }
  return error instanceof Error ? error.message : 'Permintaan tidak dapat diproses. Periksa koneksi lalu coba lagi.';
}
