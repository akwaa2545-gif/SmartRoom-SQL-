const assert = require('node:assert/strict');
const test = require('node:test');

const { currentBangkokMonth, leaderboardEntries } = require('../src/leaderboard');

test('uses Bangkok calendar-month boundaries', () => {
  const period = currentBangkokMonth(new Date('2026-01-31T18:00:00.000Z'));
  assert.equal(period.start.toISOString(), '2026-01-31T17:00:00.000Z');
  assert.equal(period.end.toISOString(), '2026-02-28T17:00:00.000Z');
});

test('returns a safe, deterministic top five leaderboard', () => {
  const entries = leaderboardEntries([
    { EmailDisplayName: '  Bee  ', BookedMinutes: 60, BookingCount: 1 },
    { EmailDisplayName: 'Ann', BookedMinutes: 120, BookingCount: 1 },
    { EmailDisplayName: 'Carl', BookedMinutes: 60, BookingCount: 2 },
    { EmailDisplayName: '', BookedMinutes: -10, BookingCount: 1 },
    ...Array.from({ length: 5 }, (_, index) => ({
      EmailDisplayName: `User ${index}`,
      BookedMinutes: 30 - index,
      BookingCount: 1,
    })),
  ]);

  assert.deepEqual(entries.map(({ rank, displayName, minutes }) => ({ rank, displayName, minutes })), [
    { rank: 1, displayName: 'Ann', minutes: 120 },
    { rank: 2, displayName: 'Carl', minutes: 60 },
    { rank: 3, displayName: 'Bee', minutes: 60 },
    { rank: 4, displayName: 'User 0', minutes: 30 },
    { rank: 5, displayName: 'User 1', minutes: 29 },
  ]);
  assert.ok(entries.every((entry) => !Object.hasOwn(entry, 'emailKey')));
});
