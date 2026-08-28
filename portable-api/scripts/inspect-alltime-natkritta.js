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
  console.log(`Total Firestore documents: ${snapshot.size}`);

  const natkrittaBookings = [];
  let totalMin = 0;

  snapshot.forEach((doc) => {
    const d = doc.data();
    const email = (d.email || '').trim().toLowerCase();
    const organizer = (d.organizer || '').trim();
    const display = (d.emailDisplayName || '').trim();
    const dept = (d.department || d.emailDepartment || '').trim();

    // Replicate key logic from leaderboardStats.ts
    const candidateName = (display || organizer || email || "Guest").trim();
    const cleanName = candidateName.toLowerCase().replace(/^(k\.|khun\s+)/i, '').trim();
    const nameParts = cleanName.split(/[\s._-]+/).filter(Boolean);
    const rootFirstName = nameParts[0] || 'guest';
    const emailPrefix = email ? email.split('@')[0].split(/[\s._-]+/).filter(Boolean)[0] : '';
    const personToken = (rootFirstName && rootFirstName !== 'guest' && rootFirstName !== 'meeting')
      ? rootFirstName
      : emailPrefix || 'guest';
    const cleanDept = dept.toLowerCase().replace(/[^a-z0-9]/g, '') || 'general';
    const key = personToken !== 'guest' ? `person:${cleanDept}:${personToken}` : `guest:${candidateName.toLowerCase()}`;

    if (key.includes('natkritta') || email.includes('natkritta') || organizer.toLowerCase().includes('natkritta')) {
      const start = d.startTime?.toDate ? d.startTime.toDate() : new Date(d.startTime);
      const end = d.endTime?.toDate ? d.endTime.toDate() : new Date(d.endTime);
      const mins = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
      totalMin += mins;
      natkrittaBookings.push({
        id: doc.id,
        key,
        title: d.title,
        organizer: d.organizer,
        email: d.email,
        display: d.emailDisplayName,
        dept: d.department,
        start: start.toISOString(),
        end: end.toISOString(),
        hrs: (mins / 60).toFixed(1),
        status: d.status,
      });
    }
  });

  console.log(`\nMatched bookings for Natkritta: ${natkrittaBookings.length} bookings, ${(totalMin / 60).toFixed(1)} hours (${totalMin} mins)`);
  console.table(natkrittaBookings);
  process.exit(0);
}

run().catch(console.error);
