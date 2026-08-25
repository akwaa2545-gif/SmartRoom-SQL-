const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function currentBangkokMonth(now = new Date()) {
  const bangkok = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const year = bangkok.getUTCFullYear();
  const month = bangkok.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1) - BANGKOK_OFFSET_MS);
  const end = new Date(Date.UTC(year, month + 1, 1) - BANGKOK_OFFSET_MS);
  return Object.freeze({ start, end });
}

function cleanDisplayName(value) {
  return typeof value === 'string' ? value.trim().slice(0, 200) : '';
}

function rankedLeaderboardRows(rows) {
  const sorted = [...rows]
    .map((row) => ({
      emailKey: typeof row.EmailKey === 'string' ? row.EmailKey : '',
      displayName: cleanDisplayName(row.EmailDisplayName) || 'Room user',
      minutes: Math.max(0, Number(row.BookedMinutes) || 0),
      bookings: Math.max(0, Number(row.BookingCount) || 0),
    }))
    .sort((left, right) =>
      right.minutes - left.minutes ||
      right.bookings - left.bookings ||
      left.displayName.localeCompare(right.displayName),
    )
    .slice(0, 5);
  return sorted.map((entry, index) => Object.freeze({ ...entry, rank: index + 1 }));
}

function leaderboardEntries(rows) {
  return rankedLeaderboardRows(rows).map(({ emailKey, ...entry }) => entry);
}

module.exports = { currentBangkokMonth, leaderboardEntries, rankedLeaderboardRows };
