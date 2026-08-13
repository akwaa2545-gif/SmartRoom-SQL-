IF OBJECT_ID(N'dbo.EmailQueue', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EmailQueue (
    BookingId nvarchar(128) NOT NULL PRIMARY KEY,
    ScheduledAt datetime2 NOT NULL,
    Status nvarchar(20) NOT NULL CONSTRAINT DF_EmailQueue_Status DEFAULT N'queued',
    AttemptCount int NOT NULL CONSTRAINT DF_EmailQueue_AttemptCount DEFAULT 0,
    ProcessingStartedAt datetime2 NULL,
    LastError nvarchar(1000) NULL,
    CreatedAt datetime2 NOT NULL CONSTRAINT DF_EmailQueue_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2 NOT NULL CONSTRAINT DF_EmailQueue_UpdatedAt DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_EmailQueue_Due ON dbo.EmailQueue (Status, ScheduledAt);
END

GRANT SELECT, INSERT, UPDATE ON dbo.EmailQueue TO SmartroomIT;
