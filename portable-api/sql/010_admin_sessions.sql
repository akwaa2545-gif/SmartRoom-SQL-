IF OBJECT_ID(N'dbo.SmartRoomAdminSessions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SmartRoomAdminSessions (
    SessionId uniqueidentifier NOT NULL CONSTRAINT PK_SmartRoomAdminSessions PRIMARY KEY,
    AdminId uniqueidentifier NOT NULL,
    Username nvarchar(128) NOT NULL,
    Role nvarchar(20) NOT NULL,
    IpAddress nvarchar(64) NOT NULL,
    UserAgent nvarchar(512) NULL,
    DeviceLabel nvarchar(120) NOT NULL,
    CreatedAt datetime2 NOT NULL CONSTRAINT DF_SmartRoomAdminSessions_CreatedAt DEFAULT SYSUTCDATETIME(),
    LastSeenAt datetime2 NOT NULL CONSTRAINT DF_SmartRoomAdminSessions_LastSeenAt DEFAULT SYSUTCDATETIME(),
    ExpiresAt datetime2 NOT NULL,
    RevokedAt datetime2 NULL,
    CONSTRAINT CK_SmartRoomAdminSessions_Role CHECK (Role IN (N'SUPER_ADMIN', N'APPROVER'))
  );
END

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_SmartRoomAdminSessions_Active'
    AND object_id = OBJECT_ID(N'dbo.SmartRoomAdminSessions')
)
BEGIN
  CREATE INDEX IX_SmartRoomAdminSessions_Active
    ON dbo.SmartRoomAdminSessions (LastSeenAt, ExpiresAt, RevokedAt)
    INCLUDE (AdminId, Username, Role, IpAddress, DeviceLabel, CreatedAt);
END

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_SmartRoomAdminSessions_Admin'
    AND object_id = OBJECT_ID(N'dbo.SmartRoomAdminSessions')
)
BEGIN
  CREATE INDEX IX_SmartRoomAdminSessions_Admin
    ON dbo.SmartRoomAdminSessions (AdminId, CreatedAt);
END

-- Activity rows are operational presence data, not credentials. The API needs
-- to write/touch/revoke them and the Super Admin activity endpoint needs to read them.
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.SmartRoomAdminSessions TO SmartroomIT;
