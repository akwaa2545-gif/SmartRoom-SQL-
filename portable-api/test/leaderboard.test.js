const assert = require('node:assert/strict');
const test = require('node:test');

const { currentBangkokMonth, leaderboardEntries, leaderboardScoresQuery, monthlyMascotRewards } = require('../src/leaderboard');

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
    { rank: 1, displayName: 'Carl', minutes: 60 },
    { rank: 2, displayName: 'Ann', minutes: 120 },
    { rank: 3, displayName: 'Bee', minutes: 60 },
    { rank: 4, displayName: 'User 0', minutes: 30 },
    { rank: 5, displayName: 'User 1', minutes: 29 },
  ]);
  assert.ok(entries.every((entry) => !Object.hasOwn(entry, 'emailKey')));
});

test('assigns the five monthly rank mascots to corporate-email leaderboard users', () => {
  const rewards = monthlyMascotRewards([
    { EmailKey: 'email:one@yageo.com', EmailDisplayName: 'One', BookedMinutes: 60, BookingCount: 5 },
    { EmailKey: 'email:two@yageo.com', EmailDisplayName: 'Two', BookedMinutes: 120, BookingCount: 4 },
    { EmailKey: 'email:three@yageo.com', EmailDisplayName: 'Three', BookedMinutes: 90, BookingCount: 3 },
    { EmailKey: 'email:four@yageo.com', EmailDisplayName: 'Four', BookedMinutes: 60, BookingCount: 2 },
    { EmailKey: 'email:five@yageo.com', EmailDisplayName: 'Five', BookedMinutes: 30, BookingCount: 1 },
  ]);

  assert.deepEqual(rewards, [
    { email: 'one@yageo.com', mascotId: 'king-cat', rank: 1 },
    { email: 'two@yageo.com', mascotId: 'bunny', rank: 2 },
    { email: 'three@yageo.com', mascotId: 'pig', rank: 3 },
    { email: 'four@yageo.com', mascotId: 'penguin', rank: 4 },
    { email: 'five@yageo.com', mascotId: 'panda', rank: 5 },
  ]);
});

test('uses SQL Server-compatible minute duration scoring', () => {
  const query = leaderboardScoresQuery();

  assert.match(query, /DATEDIFF\(minute, StartTime, EndTime\)/);
  assert.doesNotMatch(query, /DATEDIFF_BIG/);
});
