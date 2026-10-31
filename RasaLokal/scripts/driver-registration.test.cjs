const assert = require('node:assert/strict');
const { test } = require('node:test');
const { driverAccessFromRow, validateDriverRegistration } = require('../src/lib/driverRegistration.ts');

const user = { id: 'user-1', user_metadata: { full_name: 'Samuel', phone: '08123456789' } };
const row = { user_id: user.id, name: 'Samuel', phone: '08123456789', vehicle: 'Motor · BG 1234 AB', active: false };

test('sign-in, registration, approval, and active driver access remain distinct', () => {
  assert.equal(driverAccessFromRow(null, null).kind, 'guest');
  assert.deepEqual(driverAccessFromRow(user, null), { kind: 'unregistered', userId: user.id, name: 'Samuel', phone: '08123456789' });
  assert.equal(driverAccessFromRow(user, row).kind, 'pending');
  assert.equal(driverAccessFromRow(user, { ...row, active: true }).kind, 'active');
});

test('editable user metadata cannot grant driver access and another account cannot be displayed', () => {
  assert.equal(driverAccessFromRow({ ...user, user_metadata: { active: true, role: 'driver' } }, null).kind, 'unregistered');
  assert.equal(driverAccessFromRow(user, { ...row, active: 'true' }).kind, 'pending');
  assert.throws(() => driverAccessFromRow(user, { ...row, user_id: 'another-user' }), /tidak sesuai/);
});

test('registration normalizes vehicle details and rejects incomplete or invalid data', () => {
  const valid = { name: ' Samuel ', phone: '+62 812-3456-789', vehicleType: 'Motor', plateNumber: ' bg  1234 ab ' };
  assert.deepEqual(validateDriverRegistration(valid), { name: 'Samuel', phone: '+62 812-3456-789', vehicleType: 'Motor', plateNumber: 'BG 1234 AB' });
  for (const override of [{ name: '' }, { phone: 'abc08123456789' }, { phone: '123' }, { vehicleType: 'Unknown' }, { plateNumber: '123456' }, { plateNumber: 'BG<script>12' }]) {
    assert.throws(() => validateDriverRegistration({ ...valid, ...override }));
  }
});
