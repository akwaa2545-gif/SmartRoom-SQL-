IF OBJECT_ID(N'dbo.SmartRoomAdmins', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SmartRoomAdmins (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_SmartRoomAdmins PRIMARY KEY,
    Username nvarchar(128) NOT NULL CONSTRAINT UQ_SmartRoomAdmins_Username UNIQUE,
    DisplayName nvarchar(200) NULL,
    Role nvarchar(20) NOT NULL,
    PasswordHash nvarchar(512) NOT NULL,
    SessionVersion uniqueidentifier NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_SmartRoomAdmins_IsActive DEFAULT 1,
    CreatedAt datetime2 NOT NULL CONSTRAINT DF_SmartRoomAdmins_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2 NOT NULL CONSTRAINT DF_SmartRoomAdmins_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_SmartRoomAdmins_Role CHECK (Role IN (N'SUPER_ADMIN', N'APPROVER'))
  );
END

-- The portable API login needs only these permissions on this table.
-- Replace SmartroomIT only if your API uses a different SQL login.
GRANT SELECT, INSERT, UPDATE ON dbo.SmartRoomAdmins TO SmartroomIT;
