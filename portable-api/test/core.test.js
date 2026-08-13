const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertYageoEmail,
  assertBookingId,
  extractLookupUsers,
  getCheckInWindowState,
} = require('../src/core');

test('accepts and normalizes a YAGEO email address', () => {
  assert.equal(assertYageoEmail(' Person@YAGEO.COM '), 'person@yageo.com');
});

test('rejects an email address outside the YAGEO domain', () => {
  assert.throws(() => assertYageoEmail('person@example.com'), /@yageo\.com/);
});

test('accepts safe booking document identifiers only', () => {
  assert.equal(assertBookingId('booking_123-ABC'), 'booking_123-ABC');
  assert.throws(() => assertBookingId('../booking'), /bookingId is invalid/);
});

test('extracts users returned inside a Power Automate response body', () => {
  const users = extractLookupUsers({ body: JSON.stringify({ value: [{ mail: 'person@yageo.com' }] }) });
  assert.deepEqual(users, [{ mail: 'person@yageo.com' }]);
});

test('identifies a booking before its check-in window', () => {
  const startTime = new Date('2026-08-11T03:00:00.000Z');
  assert.equal(
    getCheckInWindowState({ startTime }, startTime.getTime() - (16 * 60 * 1000)).state,
    'too-early',
  );
});
