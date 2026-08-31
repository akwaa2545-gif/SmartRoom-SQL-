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

  // This Month = August 2026
  const result = await pool.request().query(`
    SELECT 
      Email,
      COUNT(*) AS TotalBookingsThisMonth,
      SUM(DATEDIFF(minute, StartTime, EndTime)) / 60.0 AS TotalHoursThisMonth
    FROM [SmartRoom].[dbo].[Bookings]
    WHERE 
      Email LIKE '%@yageo.com'
      AND YEAR(StartTime) = YEAR(GETDATE())
      AND MONTH(StartTime) = MONTH(GETDATE())
    GROUP BY Email
    ORDER BY TotalBookingsThisMonth DESC;
  `);

  console.log(`\n📅 This Month (${new Date().toLocaleString('th-TH', { month: 'long', year: 'numeric' })}) - Bookings by @yageo.com Email:`);
  console.table(result.recordset);

  console.log(`\nTotal unique @yageo.com users this month: ${result.recordset.length}`);
  const totalBookings = result.recordset.reduce((s, r) => s + r.TotalBookingsThisMonth, 0);
  const totalHours = result.recordset.reduce((s, r) => s + Number(r.TotalHoursThisMonth), 0);
  console.log(`Total bookings this month: ${totalBookings}`);
  console.log(`Total hours this month: ${totalHours.toFixed(1)}`);

  await pool.close();
  process.exit(0);
}

run().catch(console.error);
