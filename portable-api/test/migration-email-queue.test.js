const test = require('node:test');
const assert = require('node:assert/strict');

const { legacyBookingEmailQueueDetails } = require('../src/migration-email-queue');

const NOW = new Date('2026-08-13T00:00:00.000Z');

test('queues an eligible migrated booking at its legacy scheduled time', () => {
  const scheduledAt = new Date('2026-08-13T03:45:00.000Z');
  const result = legacyBookingEmailQueueDetails({
    status: 'CONFIRMED',
    startTime: '2026-08-13T04:00:00.000Z',
    verificationEmailStatus: 'queued',
    verificationEmailScheduledAt: scheduledAt.toISOString(),
  }, NOW);

  assert.deepEqual(result, { scheduledAt, opensAt: scheduledAt, closesAt: new Date('2026-08-13T04:15:00.000Z') });
});

test('derives the check-in window for an eligible legacy booking with no schedule', () => {
  const result = legacyBookingEmailQueueDetails({
    status: 'CONFIRMED',
    startTime: '2026-08-13T04:00:00.000Z',
  }, NOW);

  assert.deepEqual(result, {
    scheduledAt: new Date('2026-08-13T03:45:00.000Z'),
    opensAt: new Date('2026-08-13T03:45:00.000Z'),
    closesAt: new Date('2026-08-13T04:15:00.000Z'),
  });
});

test('does not queue migrated bookings that were sent, completed, or expired', () => {
  for (const booking of [
    { status: 'CONFIRMED', startTime: '2026-08-13T04:00:00.000Z', verificationEmailStatus: 'sent' },
    { status: 'VERIFIED', startTime: '2026-08-13T04:00:00.000Z', verificationEmailStatus: 'queued' },
    { status: 'CONFIRMED', startTime: '2026-08-12T04:00:00.000Z', verificationEmailStatus: 'queued' },
  ]) {
    assert.equal(legacyBookingEmailQueueDetails(booking, NOW), null);
  }
});
