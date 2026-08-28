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

async function run() {
  const snapshot = await firestore.collection('bookings').get();
  
  const map = new Map();

  snapshot.forEach((doc) => {
    const b = doc.data();
    const email = (b.email || "").trim().toLowerCase();
    if (email === "usani.chansod@yageo.com") return;

    const emailDisplayName = (b.emailDisplayName || "").trim();
    const organizer = (b.organizer || "").trim();
    const dept = b.department || b.emailDepartment || "Other";

    const candidateName = (emailDisplayName || organizer || email || "Guest").trim();

    const cleanName = candidateName
      .toLowerCase()
      .replace(/^(k\.|khun\s+)/i, '')
      .trim();
    const nameParts = cleanName.split(/[\s._-]+/).filter(Boolean);
    const rootFirstName = nameParts[0] || 'guest';

    const emailPrefix = email ? email.split('@')[0].split(/[\s._-]+/).filter(Boolean)[0] : '';
    const personToken = (rootFirstName && rootFirstName !== 'guest' && rootFirstName !== 'meeting')
      ? rootFirstName
      : emailPrefix || 'guest';

    const cleanDept = dept.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'general';
    const key = personToken !== 'guest' ? `person:${cleanDept}:${personToken}` : `guest:${candidateName.toLowerCase()}`;

    if (!map.has(key)) {
      map.set(key, { key, name: candidateName, items: [], totalMin: 0 });
    }
    const start = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
    const end = b.endTime?.toDate ? b.endTime.toDate() : new Date(b.endTime);
    const mins = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
    const entry = map.get(key);
    entry.totalMin += mins;
    entry.items.push({
      id: doc.id,
      title: b.title,
      organizer: b.organizer,
      email: b.email,
      display: b.emailDisplayName,
      dept: b.department,
      mins
    });
  });

  const nat = map.get('person:hr:natkritta');
  console.log('Natkritta entry:', {
    key: nat.key,
    name: nat.name,
    count: nat.items.length,
    hours: (nat.totalMin / 60).toFixed(1),
  });
  console.table(nat.items);
  process.exit(0);
}

run().catch(console.error);
