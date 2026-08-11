const assert = require('node:assert/strict');
const test = require('node:test');

const { createPasswordRecord, verifyPassword, createSession, verifySession } = require('../src/admin-auth');

test('verifies a password against a salted PBKDF2 record', () => {
  const record = createPasswordRecord('CorrectHorseBatteryStaple');
  assert.equal(verifyPassword('CorrectHorseBatteryStaple', record), true);
});

test('rejects an incorrect admin password', () => {
  const record = createPasswordRecord('CorrectHorseBatteryStaple');
  assert.equal(verifyPassword('incorrect password', record), false);
});

test('verifies a signed, non-expired admin session', () => {
  const signingKey = 'unit-test-signing-key';
  const token = createSession({ username: 'admin', role: 'SUPER_ADMIN', sessionVersion: '1' }, signingKey, Date.now() + 60_000);
  assert.deepEqual(verifySession(token, signingKey).username, 'admin');
});

test('rejects a modified admin session', () => {
  const signingKey = 'unit-test-signing-key';
  const token = createSession({ username: 'admin', role: 'SUPER_ADMIN', sessionVersion: '1' }, signingKey, Date.now() + 60_000);
  assert.equal(verifySession(`${token}x`, signingKey), null);
});
