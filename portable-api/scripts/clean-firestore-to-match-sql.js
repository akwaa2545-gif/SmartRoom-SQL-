const fs = require('node:fs');
const path = require('node:path');
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

const servicePath = path.resolve(root, process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './secrets/firebase-service-account.json');
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
  options: { encrypt: true, trustServerCertificate: true },
};

async function clean() {
  const pool = await sql.connect(sqlConfig);
  const sqlRes = await pool.request().query('SELECT Id FROM dbo.Bookings;');
  const sqlIds = new Set(sqlRes.recordset.map((r) => r.Id));
  console.log(`Valid SQL Server booking count: ${sqlIds.size}`);

  const snapshot = await firestore.collection('bookings').get();
  console.log(`Current Firestore booking count: ${snapshot.size}`);

  let deletedCount = 0;
  const batch = firestore.batch();
  let inBatch = 0;

  for (const doc of snapshot.docs) {
    if (!sqlIds.has(doc.id)) {
      batch.delete(doc.ref);
      deletedCount++;
      inBatch++;
      if (inBatch >= 400) {
        await batch.commit();
        inBatch = 0;
      }
    }
  }

  if (inBatch > 0) {
    await batch.commit();
  }

  console.log(`Deleted ${deletedCount} orphaned/mock bookings from Firestore.`);
  const after = await firestore.collection('bookings').get();
  console.log(`Firestore now has exactly ${after.size} documents matching SQL Server.`);

  await pool.close();
  process.exit(0);
}

clean().catch(console.error);
