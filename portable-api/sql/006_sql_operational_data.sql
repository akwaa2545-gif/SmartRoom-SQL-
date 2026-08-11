USE [SmartRoom];
GO

IF OBJECT_ID(N'dbo.Rooms', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Rooms (
    Id nvarchar(128) NOT NULL PRIMARY KEY,
    Name nvarchar(200) NOT NULL,
    RoomType nvarchar(80) NOT NULL,
    Capacity int NOT NULL,
    ImageUrl nvarchar(max) NOT NULL CONSTRAINT DF_Rooms_ImageUrl DEFAULT N'',
    IsClosed bit NOT NULL CONSTRAINT DF_Rooms_IsClosed DEFAULT 0,
    ClosureReason nvarchar(200) NULL,
    ClosureStartDate date NULL,
    ClosureEndDate date NULL,
    ClosureStartTime int NULL,
    ClosureEndTime int NULL,
    CreatedAt datetime2 NOT NULL CONSTRAINT DF_Rooms_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2 NOT NULL CONSTRAINT DF_Rooms_UpdatedAt DEFAULT SYSUTCDATETIME()
  );
END

IF OBJECT_ID(N'dbo.RoomAmenities', N'U') IS NULL
  CREATE TABLE dbo.RoomAmenities (RoomId nvarchar(128) NOT NULL, Amenity nvarchar(200) NOT NULL, CONSTRAINT PK_RoomAmenities PRIMARY KEY (RoomId, Amenity));

IF OBJECT_ID(N'dbo.RoomMaintenanceHistory', N'U') IS NULL
  CREATE TABLE dbo.RoomMaintenanceHistory (Id nvarchar(180) NOT NULL PRIMARY KEY, RoomId nvarchar(128) NOT NULL, RoomName nvarchar(200) NOT NULL, Reason nvarchar(200) NOT NULL, StartDate date NOT NULL, EndDate date NOT NULL, StartTime int NOT NULL, EndTime int NOT NULL, CreatedAt datetime2 NOT NULL CONSTRAINT DF_RoomMaintenanceHistory_CreatedAt DEFAULT SYSUTCDATETIME());

IF OBJECT_ID(N'dbo.MissedCheckInHistory', N'U') IS NULL
  CREATE TABLE dbo.MissedCheckInHistory (Id nvarchar(128) NOT NULL PRIMARY KEY, OriginalBookingId nvarchar(128) NOT NULL, Payload nvarchar(max) NOT NULL, ArchivedAt datetime2 NOT NULL, ArchiveReason nvarchar(200) NOT NULL);

IF OBJECT_ID(N'dbo.Announcements', N'U') IS NULL
  CREATE TABLE dbo.Announcements (Id nvarchar(128) NOT NULL PRIMARY KEY, Title nvarchar(200) NOT NULL, Message nvarchar(max) NOT NULL, Category nvarchar(40) NOT NULL, ImageUrl nvarchar(max) NOT NULL CONSTRAINT DF_Announcements_ImageUrl DEFAULT N'', ButtonText nvarchar(100) NOT NULL CONSTRAINT DF_Announcements_ButtonText DEFAULT N'', ButtonUrl nvarchar(2048) NOT NULL CONSTRAINT DF_Announcements_ButtonUrl DEFAULT N'', StartAt datetime2 NULL, EndAt datetime2 NULL, IsActive bit NOT NULL, ShowOnce bit NOT NULL, TargetPages nvarchar(max) NOT NULL, Audience nvarchar(30) NOT NULL, Priority int NOT NULL, CreatedAt datetime2 NOT NULL CONSTRAINT DF_Announcements_CreatedAt DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NOT NULL CONSTRAINT DF_Announcements_UpdatedAt DEFAULT SYSUTCDATETIME());

IF OBJECT_ID(N'dbo.FirestoreMigrationAudit', N'U') IS NULL
  CREATE TABLE dbo.FirestoreMigrationAudit (RunId uniqueidentifier NOT NULL, CollectionName nvarchar(100) NOT NULL, DocumentId nvarchar(180) NOT NULL, Outcome nvarchar(20) NOT NULL, ErrorMessage nvarchar(1000) NULL, ProcessedAt datetime2 NOT NULL CONSTRAINT DF_FirestoreMigrationAudit_ProcessedAt DEFAULT SYSUTCDATETIME(), CONSTRAINT PK_FirestoreMigrationAudit PRIMARY KEY (RunId, CollectionName, DocumentId));

GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.Rooms TO SmartroomIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.RoomAmenities TO SmartroomIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.RoomMaintenanceHistory TO SmartroomIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.MissedCheckInHistory TO SmartroomIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.Announcements TO SmartroomIT;
GRANT SELECT, INSERT ON dbo.FirestoreMigrationAudit TO SmartroomIT;
