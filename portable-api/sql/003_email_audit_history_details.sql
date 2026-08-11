IF COL_LENGTH(N'dbo.EmailAudit', N'RelatedBookingTitle') IS NULL
  ALTER TABLE dbo.EmailAudit ADD RelatedBookingTitle nvarchar(500) NULL;

IF COL_LENGTH(N'dbo.EmailAudit', N'RelatedRoomId') IS NULL
  ALTER TABLE dbo.EmailAudit ADD RelatedRoomId nvarchar(128) NULL;

IF COL_LENGTH(N'dbo.EmailAudit', N'RelatedRoomName') IS NULL
  ALTER TABLE dbo.EmailAudit ADD RelatedRoomName nvarchar(500) NULL;

GRANT SELECT, INSERT ON dbo.EmailAudit TO SmartroomIT;
