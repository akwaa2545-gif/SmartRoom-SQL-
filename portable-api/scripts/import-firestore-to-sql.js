/*
 * One-time SmartRoom Firestore -> SQL Server importer.
 * Default mode is read-only reporting. SQL writes require:
 *   node scripts/import-firestore-to-sql.js --apply --confirm=IMPORT_SMARTROOM
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const sql = require('mssql');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
for (const raw of (fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '').split(/\r?\n/)) {
  const line = raw.trim();
  const separator = line.indexOf('=');
  if (!line || line.startsWith('#') || separator < 1) continue;
  const key = line.slice(0, separator).trim();
  const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
  if (!process.env[key]) process.env[key] = value;
}

const apply = process.argv.includes('--apply');
const confirmed = process.argv.includes('--confirm=IMPORT_SMARTROOM');
if (apply && !confirmed) throw new Error('Refusing SQL writes. Use --apply --confirm=IMPORT_SMARTROOM after validating the backup.');

const serviceArgument = process.argv.find((argument) => argument.startsWith('--service-account='));
const databaseArgument = process.argv.find((argument) => argument.startsWith('--database='));
const backupArgument = process.argv.find((argument) => argument.startsWith('--backup='));
const servicePath = path.resolve(root, serviceArgument ? serviceArgument.slice('--service-account='.length) : process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '');
const backupInputPath = backupArgument ? path.resolve(root, backupArgument.slice('--backup='.length)) : null;
if (backupInputPath && !fs.existsSync(backupInputPath)) throw new Error(`Backup file was not found: ${backupInputPath}`);
if (!backupInputPath && (!servicePath || !fs.existsSync(servicePath))) throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH is missing or invalid.');
const requiredSql = ['SQL_SERVER', 'SQL_DATABASE', 'SQL_USER', 'SQL_PASSWORD'];
if (apply && requiredSql.some((key) => !process.env[key])) throw new Error(`Missing SQL configuration: ${requiredSql.filter((key) => !process.env[key]).join(', ')}`);

let firestore;
if (!backupInputPath) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(servicePath, 'utf8'))) });
  // A command-line value is useful for one-time recovery work; otherwise use the
  // named Firestore database configured for this application.
  const databaseId = databaseArgument ? databaseArgument.slice('--database='.length) : process.env.FIREBASE_DATABASE_ID;
  firestore = databaseId ? getFirestore(databaseId) : getFirestore();
}
let pool;
const getPool = async () => {
  if (!pool) pool = new sql.ConnectionPool({ server: process.env.SQL_SERVER, database: process.env.SQL_DATABASE, user: process.env.SQL_USER, password: process.env.SQL_PASSWORD, options: { encrypt: true, trustServerCertificate: true } });
  if (!pool.connected) await pool.connect();
  return pool;
};
const runId = crypto.randomUUID();
const backupPath = path.resolve(root, `migration-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

const date = (value) => {
  if (value?.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (value && Number.isFinite(value._seconds)) {
    const milliseconds = (value._seconds * 1000) + Math.floor((Number(value._nanoseconds) || 0) / 1_000_000);
    return new Date(milliseconds).toISOString();
  }
  return value || null;
};
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const status = (value) => {
  if (!['PENDING', 'CONFIRMED', 'VERIFIED', 'REJECTED', 'NO_SHOW'].includes(value)) throw new Error('Missing or invalid booking status.');
  return value;
};

async function audit(transaction, collection, id, outcome, errorMessage = null) {
  await new sql.Request(transaction)
    .input('runId', sql.UniqueIdentifier, runId)
    .input('collection', sql.NVarChar(100), collection)
    .input('id', sql.NVarChar(180), id)
    .input('outcome', sql.NVarChar(20), outcome)
    .input('error', sql.NVarChar(1000), errorMessage)
    .query(`INSERT INTO dbo.FirestoreMigrationAudit (RunId, CollectionName, DocumentId, Outcome, ErrorMessage) VALUES (@runId, @collection, @id, @outcome, @error);`);
}

async function importRoom(id, value, transaction) {
  const name = text(value.name, 200);
  const type = text(value.type, 80);
  const capacity = Number(value.capacity);
  if (!id || !name || !type || !Number.isInteger(capacity) || capacity < 1) throw new Error('Missing or invalid room identity, name, type, or capacity.');
  const amenities = [...new Set(Array.isArray(value.amenities) ? value.amenities.map((item) => text(item, 200)).filter(Boolean) : [])];
  await new sql.Request(transaction)
    .input('id', sql.NVarChar(128), id).input('name', sql.NVarChar(200), text(value.name, 200))
    .input('type', sql.NVarChar(80), type).input('capacity', sql.Int, capacity)
    .input('imageUrl', sql.NVarChar(sql.MAX), text(value.imageUrl, 1_000_000)).input('isClosed', sql.Bit, Boolean(value.isClosed))
    .input('reason', sql.NVarChar(200), text(value.closureReason, 200) || null)
    .input('startDate', sql.Date, value.closureStartDate || null).input('endDate', sql.Date, value.closureEndDate || null)
    .input('startTime', sql.Int, Number.isInteger(value.closureStartTime) ? value.closureStartTime : null).input('endTime', sql.Int, Number.isInteger(value.closureEndTime) ? value.closureEndTime : null)
      .query(`MERGE dbo.Rooms WITH (HOLDLOCK) AS target USING (SELECT @id AS Id) AS source ON target.Id=source.Id WHEN MATCHED THEN UPDATE SET Name=@name,RoomType=@type,Capacity=@capacity,ImageUrl=@imageUrl,IsClosed=@isClosed,ClosureReason=@reason,ClosureStartDate=@startDate,ClosureEndDate=@endDate,ClosureStartTime=@startTime,ClosureEndTime=@endTime,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT (Id,Name,RoomType,Capacity,ImageUrl,IsClosed,ClosureReason,ClosureStartDate,ClosureEndDate,ClosureStartTime,ClosureEndTime) VALUES (@id,@name,@type,@capacity,@imageUrl,@isClosed,@reason,@startDate,@endDate,@startTime,@endTime);`);
  await new sql.Request(transaction).input('id', sql.NVarChar(128), id).query('DELETE FROM dbo.RoomAmenities WHERE RoomId=@id;');
  for (const amenity of amenities) await new sql.Request(transaction).input('id', sql.NVarChar(128), id).input('amenity', sql.NVarChar(200), amenity).query('INSERT INTO dbo.RoomAmenities (RoomId,Amenity) VALUES (@id,@amenity);');
}

async function importBooking(id, value, transaction) {
  const start = date(value.startTime); const end = date(value.endTime);
  if (!start || !end || new Date(end) <= new Date(start)) throw new Error('Missing or invalid booking time.');
  await new sql.Request(transaction)
    .input('id', sql.NVarChar(128), id).input('roomId', sql.NVarChar(128), text(value.roomId, 128))
    .input('title', sql.NVarChar(200), text(value.title, 200) || 'Untitled booking').input('organizer', sql.NVarChar(100), text(value.organizer, 100) || 'Unknown')
    .input('department', sql.NVarChar(120), text(value.department, 120)).input('employeeId', sql.NVarChar(60), text(value.employeeId, 60)).input('desk', sql.NVarChar(60), text(value.deskNumber, 60))
    .input('email', sql.NVarChar(254), text(value.email, 254) || 'unknown@yageo.com').input('displayName', sql.NVarChar(200), text(value.emailDisplayName, 200)).input('jobTitle', sql.NVarChar(200), text(value.emailJobTitle, 200)).input('emailDepartment', sql.NVarChar(200), text(value.emailDepartment, 200))
    .input('uid', sql.NVarChar(128), text(value.createdByUid, 128)).input('start', sql.DateTime2, start).input('end', sql.DateTime2, end)
    .input('status', sql.NVarChar(20), status(value.status)).input('emailStatus', sql.NVarChar(20), text(value.verificationEmailStatus, 20) || 'queued')
    .input('scheduled', sql.DateTime2, date(value.verificationEmailScheduledAt)).input('opened', sql.DateTime2, date(value.verificationWindowOpenedAt)).input('closed', sql.DateTime2, date(value.verificationWindowClosedAt))
    .input('sent', sql.DateTime2, date(value.verificationEmailSentAt)).input('failed', sql.DateTime2, date(value.verificationEmailFailedAt))
    .input('tokenHash', sql.Char(64), text(value.verificationTokenHash, 64) || null).input('usedHash', sql.Char(64), text(value.verificationTokenUsedHash, 64) || null)
    .input('tokenCreated', sql.DateTime2, date(value.verificationTokenCreatedAt)).input('tokenExpires', sql.DateTime2, date(value.verificationTokenExpiresAt))
    .input('verified', sql.DateTime2, date(value.verifiedAt)).input('actualStart', sql.DateTime2, date(value.actualStartTime))
    .query(`MERGE dbo.Bookings WITH (HOLDLOCK) AS target USING (SELECT @id AS Id) AS source ON target.Id=source.Id WHEN MATCHED THEN UPDATE SET RoomId=@roomId,Title=@title,Organizer=@organizer,Department=@department,EmployeeId=@employeeId,DeskNumber=@desk,Email=@email,EmailDisplayName=@displayName,EmailJobTitle=@jobTitle,EmailDepartment=@emailDepartment,CreatedByUid=@uid,StartTime=@start,EndTime=@end,Status=@status,VerificationEmailStatus=@emailStatus,VerificationEmailScheduledAt=@scheduled,VerificationWindowOpenedAt=@opened,VerificationWindowClosedAt=@closed,VerificationEmailSentAt=@sent,VerificationEmailFailedAt=@failed,VerificationTokenHash=@tokenHash,VerificationTokenUsedHash=@usedHash,VerificationTokenCreatedAt=@tokenCreated,VerificationTokenExpiresAt=@tokenExpires,VerifiedAt=@verified,ActualStartTime=@actualStart,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT (Id,RoomId,Title,Organizer,Department,EmployeeId,DeskNumber,Email,EmailDisplayName,EmailJobTitle,EmailDepartment,CreatedByUid,StartTime,EndTime,Status,VerificationEmailStatus,VerificationEmailScheduledAt,VerificationWindowOpenedAt,VerificationWindowClosedAt,VerificationEmailSentAt,VerificationEmailFailedAt,VerificationTokenHash,VerificationTokenUsedHash,VerificationTokenCreatedAt,VerificationTokenExpiresAt,VerifiedAt,ActualStartTime) VALUES (@id,@roomId,@title,@organizer,@department,@employeeId,@desk,@email,@displayName,@jobTitle,@emailDepartment,@uid,@start,@end,@status,@emailStatus,@scheduled,@opened,@closed,@sent,@failed,@tokenHash,@usedHash,@tokenCreated,@tokenExpires,@verified,@actualStart);`);
}

async function main() {
  const collections = ['rooms', 'bookings'];
  let backup;
  if (backupInputPath) {
    backup = JSON.parse(fs.readFileSync(backupInputPath, 'utf8'));
    if (!backup?.collections || collections.some((name) => !Array.isArray(backup.collections[name]))) {
      throw new Error('Backup has an invalid SmartRoom migration format.');
    }
    for (const name of collections) {
      if (backup.collections[name].some((record) => !record || typeof record.id !== 'string' || !record.id || !record.data || typeof record.data !== 'object')) {
        throw new Error(`Backup contains an invalid ${name} record.`);
      }
    }
    console.log(`Using existing backup: ${backupInputPath}`);
  } else {
    backup = { runId, exportedAt: new Date().toISOString(), collections: {} };
    for (const name of collections) {
      const snapshot = await firestore.collection(name).get();
      backup.collections[name] = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    }
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), { encoding: 'utf8', flag: 'wx' });
    console.log(`Backup written: ${backupPath}`);
  }
  console.log(`Firestore counts: ${collections.map((name) => `${name}=${backup.collections[name].length}`).join(', ')}`);
  if (!apply) return console.log('Dry run only. Review the backup, then rerun with --apply --confirm=IMPORT_SMARTROOM.');
  const connection = await getPool();
  const transaction = new sql.Transaction(connection);
  await transaction.begin();
  try {
    for (const room of backup.collections.rooms) {
      await importRoom(room.id, room.data, transaction);
      await audit(transaction, 'rooms', room.id, 'imported');
    }
    for (const booking of backup.collections.bookings) {
      await importBooking(booking.id, booking.data, transaction);
      await audit(transaction, 'bookings', booking.id, 'imported');
    }
    await transaction.commit();
  } catch (cause) {
    await transaction.rollback();
    throw cause;
  }
  console.log(`Import complete. Run ID: ${runId}`);
}

main().finally(() => pool?.close());
