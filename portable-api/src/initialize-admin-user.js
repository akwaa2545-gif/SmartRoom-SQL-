const sql = require('mssql');
const { createPasswordRecord } = require('./admin-auth');
const { getConfig } = require('./config');

const [username, role] = process.argv.slice(2);
const password = process.env.SMARTROOM_ADMIN_SETUP_PASSWORD || '';
if (!/^[A-Za-z0-9_.-]{1,128}$/.test(username || '') || !['SUPER_ADMIN', 'APPROVER'].includes(role || '') || !password) {
  throw new Error('Invalid admin setup arguments.');
}

(async () => {
  const config = getConfig();
  const pool = await new sql.ConnectionPool(config.sql).connect();
  await pool.request()
    .input('username', sql.NVarChar(128), username)
    .input('role', sql.NVarChar(20), role)
    .input('passwordHash', sql.NVarChar(512), createPasswordRecord(password))
    .input('sessionVersion', sql.UniqueIdentifier, require('node:crypto').randomUUID())
    .query(`MERGE dbo.SmartRoomAdmins AS target
      USING (SELECT @username AS Username) AS source ON target.Username = source.Username
      WHEN MATCHED THEN UPDATE SET Role = @role, PasswordHash = @passwordHash, SessionVersion = @sessionVersion, IsActive = 1, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (Id, Username, DisplayName, Role, PasswordHash, SessionVersion, IsActive) VALUES (NEWID(), @username, @username, @role, @passwordHash, @sessionVersion, 1);`);
  await pool.close();
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
