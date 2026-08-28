const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

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

async function check() {
  const snapshot = await firestore.collection('bookings').get();
  console.log(`Total documents in Firestore bookings: ${snapshot.size}`);

  let natkrittaCount = 0;
  let natkrittaMinutes = 0;

  snapshot.forEach((doc) => {
    const d = doc.data();
    const email = (d.email || '').toLowerCase().trim();
    const organizer = (d.organizer || '').toLowerCase().trim();
    const display = (d.emailDisplayName || '').toLowerCase().trim();

    if (email.includes('natkritta') || organizer.includes('natkritta') || display.includes('natkritta')) {
      const start = d.startTime?.toDate ? d.startTime.toDate() : new Date(d.startTime);
      const end = d.endTime?.toDate ? d.endTime.toDate() : new Date(d.endTime);
      const mins = Math.round((end.getTime() - start.getTime()) / 60000);
      natkrittaCount++;
      natkrittaMinutes += mins;
      console.log(`[${d.id}] ${d.title} | org: ${d.organizer} | email: ${d.email} | start: ${start.toISOString()} | mins: ${mins} | status: ${d.status}`);
    }
  });

  console.log(`\nNatkritta total in Firestore: ${natkrittaCount} bookings, ${(natkrittaMinutes / 60).toFixed(1)} hours`);
  process.exit(0);
}

check().catch(console.error);
