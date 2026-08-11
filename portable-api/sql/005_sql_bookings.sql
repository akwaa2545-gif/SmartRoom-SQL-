USE [SmartRoom];
GO

IF OBJECT_ID(N'dbo.Bookings', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Bookings (
    Id nvarchar(128) NOT NULL PRIMARY KEY,
    RoomId nvarchar(128) NOT NULL,
    Title nvarchar(200) NOT NULL,
    Organizer nvarchar(100) NOT NULL,
    Department nvarchar(120) NOT NULL CONSTRAINT DF_Bookings_Department DEFAULT N'',
    EmployeeId nvarchar(60) NOT NULL CONSTRAINT DF_Bookings_EmployeeId DEFAULT N'',
    DeskNumber nvarchar(60) NOT NULL CONSTRAINT DF_Bookings_DeskNumber DEFAULT N'',
    Email nvarchar(254) NOT NULL,
    EmailDisplayName nvarchar(200) NOT NULL CONSTRAINT DF_Bookings_EmailDisplayName DEFAULT N'',
    EmailJobTitle nvarchar(200) NOT NULL CONSTRAINT DF_Bookings_EmailJobTitle DEFAULT N'',
    EmailDepartment nvarchar(200) NOT NULL CONSTRAINT DF_Bookings_EmailDepartment DEFAULT N'',
    CreatedByUid nvarchar(128) NOT NULL,
    StartTime datetime2 NOT NULL,
    EndTime datetime2 NOT NULL,
    Status nvarchar(20) NOT NULL CONSTRAINT DF_Bookings_Status DEFAULT N'CONFIRMED',
    VerificationEmailStatus nvarchar(20) NOT NULL CONSTRAINT DF_Bookings_EmailStatus DEFAULT N'queued',
    VerificationEmailScheduledAt datetime2 NULL,
    VerificationWindowOpenedAt datetime2 NULL,
    VerificationWindowClosedAt datetime2 NULL,
    VerificationEmailSentAt datetime2 NULL,
    VerificationEmailFailedAt datetime2 NULL,
    VerificationTokenHash char(64) NULL,
    VerificationTokenUsedHash char(64) NULL,
    VerificationTokenCreatedAt datetime2 NULL,
    VerificationTokenExpiresAt datetime2 NULL,
    VerifiedAt datetime2 NULL,
    ActualStartTime datetime2 NULL,
    CreatedAt datetime2 NOT NULL CONSTRAINT DF_Bookings_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2 NOT NULL CONSTRAINT DF_Bookings_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Bookings_TimeRange CHECK (EndTime > StartTime),
    CONSTRAINT CK_Bookings_Status CHECK (Status IN (N'PENDING', N'CONFIRMED', N'VERIFIED', N'REJECTED', N'NO_SHOW'))
  );
  CREATE INDEX IX_Bookings_RoomTime ON dbo.Bookings (RoomId, StartTime, EndTime) INCLUDE (Status);
  CREATE INDEX IX_Bookings_Creator ON dbo.Bookings (CreatedByUid, CreatedAt DESC);
END

GRANT SELECT, INSERT, UPDATE ON dbo.Bookings TO SmartroomIT;
