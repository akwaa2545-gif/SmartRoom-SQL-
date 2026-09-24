USE [SmartRoom];
GO

IF OBJECT_ID(N'dbo.Bookings', N'U') IS NULL
  THROW 51000, 'Create dbo.Bookings before adding ActualEndTime.', 1;
GO

IF COL_LENGTH(N'dbo.Bookings', N'ActualEndTime') IS NULL
  ALTER TABLE dbo.Bookings ADD ActualEndTime datetime2 NULL;
GO
