/*
 * Synchronize all Bookings from SQL Server -> Firebase Firestore
 * Usage:
 *   node scripts/sync-sql-to-firestore.js
 */
const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
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

const servicePath = path.resolve(root, process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './secrets/firebase-service-account.json');
if (!fs.existsSync(servicePath)) {
  throw new Error(`Firebase service account file not found: ${servicePath}`);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(servicePath, 'utf8'))),
});

const databaseId = process.env.FIREBASE_DATABASE_ID;
const firestore = databaseId ? getFirestore(databaseId) : getFirestore();

const sqlConfig = {
  server: process.env.SQL_SERVER || 'svr120a',
  database: process.env.SQL_DATABASE || 'SmartRoom',
  user: process.env.SQL_USER || 'SmartroomIT',
  password: process.env.SQL_PASSWORD || 'Tokin@smartRoom123',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

const toTimestamp = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
};

async function syncSqlToFirestore() {
  console.log('Connecting to SQL Server:', sqlConfig.server, sqlConfig.database);
  const pool = await sql.connect(sqlConfig);
  console.log('Connected to SQL Server successfully.');

  const result = await pool.request().query(`
    SELECT 
      Id, RoomId, Title, Organizer, Department, EmployeeId, DeskNumber,
      Email, EmailDisplayName, EmailJobTitle, EmailDepartment,
      CreatedByUid, StartTime, EndTime, Status,
      VerificationEmailStatus, VerificationEmailScheduledAt,
      VerificationWindowOpenedAt, VerificationWindowClosedAt,
      VerificationEmailSentAt, VerificationEmailFailedAt,
      VerificationTokenHash, VerificationTokenUsedHash,
      VerificationTokenCreatedAt, VerificationTokenExpiresAt,
      VerifiedAt, ActualStartTime, CreatedAt, UpdatedAt
    FROM dbo.Bookings
    ORDER BY StartTime ASC;
  `);

  const bookings = result.recordset;
  console.log(`Found ${bookings.length} total bookings in SQL Server.`);

  let writtenCount = 0;
  const batchSize = 400;

  for (let i = 0; i < bookings.length; i += batchSize) {
    const chunk = bookings.slice(i, i + batchSize);
    const batch = firestore.batch();

    for (const b of chunk) {
      const docRef = firestore.collection('bookings').doc(b.Id);
      const data = {
        id: b.Id,
        roomId: b.RoomId || '',
        title: b.Title || '',
        organizer: b.Organizer || '',
        department: b.Department || '',
        employeeId: b.EmployeeId || '',
        deskNumber: b.DeskNumber || '',
        email: b.Email || '',
        emailDisplayName: b.EmailDisplayName || '',
        emailJobTitle: b.EmailJobTitle || '',
        emailDepartment: b.EmailDepartment || '',
        createdByUid: b.CreatedByUid || 'sql-sync',
        startTime: toTimestamp(b.StartTime),
        endTime: toTimestamp(b.EndTime),
        status: b.Status || 'CONFIRMED',
      };

      if (b.ActualStartTime) data.actualStartTime = toTimestamp(b.ActualStartTime);
      if (b.VerifiedAt) data.verifiedAt = toTimestamp(b.VerifiedAt);
      if (b.CreatedAt) data.createdAt = toTimestamp(b.CreatedAt);
      if (b.UpdatedAt) data.updatedAt = toTimestamp(b.UpdatedAt);
      if (b.VerificationEmailStatus) data.verificationEmailStatus = b.VerificationEmailStatus;

      batch.set(docRef, data, { merge: true });
      writtenCount++;
    }

    await batch.commit();
    console.log(`Committed batch ${i + 1} - ${Math.min(i + batchSize, bookings.length)} of ${bookings.length}...`);
  }

  console.log(`✅ Successfully synchronized ${writtenCount} bookings from SQL Server to Firestore!`);
  await pool.close();
  process.exit(0);
}

syncSqlToFirestore().catch((err) => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
