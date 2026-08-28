const fs = require('node:fs');
const path = require('node:path');
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

const sqlConfig = {
  server: process.env.SQL_SERVER || 'svr120a',
  database: process.env.SQL_DATABASE || 'SmartRoom',
  user: process.env.SQL_USER || 'SmartroomIT',
  password: process.env.SQL_PASSWORD || 'Tokin@smartRoom123',
  options: { encrypt: true, trustServerCertificate: true },
};

async function run() {
  const pool = await sql.connect(sqlConfig);
  
  // 1. By Email
  const resEmail = await pool.request().query(`
    SELECT COUNT(*) as Cnt, SUM(DATEDIFF(minute, StartTime, EndTime))/60.0 as Hrs
    FROM dbo.Bookings
    WHERE Email = 'natkritta.suksiri@yageo.com';
  `);
  console.log('Query WHERE Email = natkritta.suksiri@yageo.com:', resEmail.recordset[0]);

  // 2. By Organizer
  const resOrg = await pool.request().query(`
    SELECT Organizer, Email, COUNT(*) as Cnt, SUM(DATEDIFF(minute, StartTime, EndTime))/60.0 as Hrs
    FROM dbo.Bookings
    WHERE Organizer LIKE '%Natkritta%' OR Email LIKE '%natkritta%'
    GROUP BY Organizer, Email;
  `);
  console.log('\nBreakdown in SQL Server:');
  console.table(resOrg.recordset);

  // 3. All bookings of Natkritta
  const resAll = await pool.request().query(`
    SELECT Id, Title, Organizer, Email, StartTime, EndTime, DATEDIFF(minute, StartTime, EndTime)/60.0 as Hrs
    FROM dbo.Bookings
    WHERE Organizer LIKE '%Natkritta%' OR Email LIKE '%natkritta%'
    ORDER BY StartTime ASC;
  `);
  console.log(`\nTotal rows matching Natkritta in SQL: ${resAll.recordset.length}`);
  
  await pool.close();
  process.exit(0);
}

run().catch(console.error);
