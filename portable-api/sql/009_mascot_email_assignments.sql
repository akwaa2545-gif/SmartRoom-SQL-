USE [SmartRoom];
GO

IF OBJECT_ID(N'dbo.MascotEmailAssignments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MascotEmailAssignments (
    Email nvarchar(254) NOT NULL PRIMARY KEY,
    MascotId nvarchar(40) NOT NULL,
    UpdatedBy nvarchar(100) NOT NULL,
    UpdatedAt datetime2 NOT NULL CONSTRAINT DF_MascotEmailAssignments_UpdatedAt DEFAULT SYSUTCDATETIME()
  );
END
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.MascotEmailAssignments TO SmartroomIT;
GO
