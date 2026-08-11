IF OBJECT_ID(N'dbo.EmailAudit', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EmailAudit (
    Id uniqueidentifier NOT NULL PRIMARY KEY,
    RecipientEmail nvarchar(254) NOT NULL,
    Subject nvarchar(500) NOT NULL,
    Purpose nvarchar(100) NOT NULL,
    Status nvarchar(20) NOT NULL,
    RelatedBookingId nvarchar(128) NULL,
    RelatedBookingTitle nvarchar(500) NULL,
    RelatedRoomId nvarchar(128) NULL,
    RelatedRoomName nvarchar(500) NULL,
    ErrorCode nvarchar(100) NULL,
    ErrorMessage nvarchar(1000) NULL,
    CreatedAt datetime2 NOT NULL CONSTRAINT DF_EmailAudit_CreatedAt DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_EmailAudit_CreatedAt ON dbo.EmailAudit (CreatedAt DESC);
END

GRANT SELECT, INSERT ON dbo.EmailAudit TO SmartroomIT;
