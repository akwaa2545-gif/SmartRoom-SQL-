USE [SmartRoom];
GO

IF OBJECT_ID(N'dbo.MascotAssignments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MascotAssignments (
    Department nvarchar(40) NOT NULL PRIMARY KEY,
    MascotId nvarchar(40) NOT NULL,
    UpdatedBy nvarchar(100) NOT NULL,
    UpdatedAt datetime2 NOT NULL CONSTRAINT DF_MascotAssignments_UpdatedAt DEFAULT SYSUTCDATETIME()
  );
END
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.MascotAssignments TO SmartroomIT;
GO
