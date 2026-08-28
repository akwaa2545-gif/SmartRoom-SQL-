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

  const userMap = new Map();

  snapshot.forEach((doc) => {
    const b = doc.data();
    const email = (b.email || "").trim().toLowerCase();
    if (email === "usani.chansod@yageo.com") return;

    const emailDisplayName = (b.emailDisplayName || "").trim();
    const organizer = (b.organizer || "").trim();
    const dept = b.department || b.emailDepartment || "Other";

    // Strict Email First Key:
    const key = email || (emailDisplayName ? `name:${emailDisplayName.toLowerCase().trim()}` : `name:${organizer.toLowerCase().trim()}`) || "guest";

    const candidateName = emailDisplayName || organizer || email || "Guest";

    const start = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
    const end = b.endTime?.toDate ? b.endTime.toDate() : new Date(b.endTime);
    const mins = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));

    if (!userMap.has(key)) {
      userMap.set(key, {
        key,
        name: candidateName,
        dept,
        totalMin: 0,
        count: 0
      });
    }

    const existing = userMap.get(key);
    if (emailDisplayName && emailDisplayName !== "Guest") {
      existing.name = emailDisplayName;
    } else if (candidateName && (!existing.name || existing.name === "Guest" || candidateName.length > existing.name.length)) {
      existing.name = candidateName;
    }
    existing.totalMin += mins;
    existing.count += 1;
  });

  const allUsers = Array.from(userMap.values())
    .map(u => ({
      name: u.name,
      dept: u.dept,
      key: u.key,
      count: u.count,
      hours: (u.totalMin / 60).toFixed(1)
    }))
    .sort((a, b) => Number(b.hours) - Number(a.hours));

  console.log('\nTop 10 Leaders on All-Time with Strict Email Key:');
  console.table(allUsers.slice(0, 10));
  process.exit(0);
}

run().catch(console.error);
