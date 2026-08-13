USE [SmartRoom];
GO

/*
  One-time, idempotent repair for bookings migrated before EmailQueue was added.
  It queues only active confirmed bookings whose verification email was never sent
  or failed, and never changes an existing queue row.
*/
DECLARE @now datetime2 = SYSUTCDATETIME();

;WITH EligibleBookings AS (
  SELECT
    b.Id,
    COALESCE(b.VerificationEmailScheduledAt, DATEADD(minute, -15, b.StartTime)) AS ScheduledAt,
    DATEADD(minute, -15, b.StartTime) AS OpensAt,
    DATEADD(minute, 15, b.StartTime) AS ClosesAt
  FROM dbo.Bookings AS b
  WHERE b.Status = N'CONFIRMED'
    AND b.ActualStartTime IS NULL
    AND (b.VerificationEmailStatus IS NULL OR LOWER(b.VerificationEmailStatus) IN (N'queued', N'pending_retry'))
    AND @now <= DATEADD(minute, 15, b.StartTime)
)
UPDATE b
SET VerificationEmailScheduledAt = COALESCE(b.VerificationEmailScheduledAt, e.ScheduledAt),
    VerificationWindowOpenedAt = COALESCE(b.VerificationWindowOpenedAt, e.OpensAt),
    VerificationWindowClosedAt = COALESCE(b.VerificationWindowClosedAt, e.ClosesAt),
    UpdatedAt = SYSUTCDATETIME()
FROM dbo.Bookings AS b
INNER JOIN EligibleBookings AS e ON e.Id = b.Id;

;WITH EligibleBookings AS (
  SELECT b.Id, COALESCE(b.VerificationEmailScheduledAt, DATEADD(minute, -15, b.StartTime)) AS ScheduledAt
  FROM dbo.Bookings AS b
  WHERE b.Status = N'CONFIRMED'
    AND b.ActualStartTime IS NULL
    AND (b.VerificationEmailStatus IS NULL OR LOWER(b.VerificationEmailStatus) IN (N'queued', N'pending_retry'))
    AND @now <= DATEADD(minute, 15, b.StartTime)
)
INSERT INTO dbo.EmailQueue (BookingId, ScheduledAt, Status)
SELECT e.Id, e.ScheduledAt, N'queued'
FROM EligibleBookings AS e
WHERE NOT EXISTS (SELECT 1 FROM dbo.EmailQueue AS q WHERE q.BookingId = e.Id);
