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

const EXCLUDED_LEADERBOARD_EMAILS = new Set([
  'usani.chansod@yageo.com',
]);

function leaderboardScoresQuery() {
  // DATEDIFF is supported by the SQL Server versions used by the on-prem API.
  // Room bookings are short-lived, so minute totals cannot approach its range.
  return `WITH Eligible AS (
      SELECT Id,
        CASE WHEN NULLIF(LTRIM(RTRIM(Email)), N'') IS NOT NULL
          THEN N'email:' + LOWER(LTRIM(RTRIM(Email)))
        WHEN NULLIF(LTRIM(RTRIM(EmployeeId)), N'') IS NOT NULL
          AND LTRIM(RTRIM(EmployeeId)) <> N'1111111'
          THEN N'employee:' + LOWER(LTRIM(RTRIM(EmployeeId)))
          ELSE N'booking:' + CONVERT(nvarchar(128), Id)
        END AS EmailKey,
        NULLIF(LTRIM(RTRIM(EmailDisplayName)), N'') AS EmailDisplayName,
        StartTime, EndTime
      FROM dbo.Bookings
      WHERE Status = N'VERIFIED'
        AND ActualStartTime IS NOT NULL
        AND LOWER(LTRIM(RTRIM(Email))) NOT IN ('usani.chansod@yageo.com')
        AND StartTime >= @periodStart
        AND EndTime < @periodEnd
        AND EndTime <= @now
    ), Scores AS (
      SELECT EmailKey, SUM(DATEDIFF(minute, StartTime, EndTime)) AS BookedMinutes,
        COUNT_BIG(*) AS BookingCount
      FROM Eligible
      GROUP BY EmailKey
    ), LatestNames AS (
      SELECT EmailKey, EmailDisplayName,
        ROW_NUMBER() OVER (PARTITION BY EmailKey ORDER BY StartTime DESC, Id DESC) AS RowNumber
      FROM Eligible
      WHERE EmailDisplayName IS NOT NULL
    )
    SELECT scores.EmailKey, COALESCE(names.EmailDisplayName, N'Room user') AS EmailDisplayName,
      scores.BookedMinutes, scores.BookingCount
    FROM Scores AS scores
    LEFT JOIN LatestNames AS names
      ON names.EmailKey = scores.EmailKey AND names.RowNumber = 1;`;
}

function rankedLeaderboardRows(rows) {
  const sorted = [...rows]
    .filter((row) => !EXCLUDED_LEADERBOARD_EMAILS.has(String(row.EmailKey || '').trim().toLowerCase()))
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

module.exports = { currentBangkokMonth, leaderboardEntries, rankedLeaderboardRows, leaderboardScoresQuery, EXCLUDED_LEADERBOARD_EMAILS };
