
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = '/Users/hakancineli/whatistaspp/data/database.db';
const db = new Database(dbPath);

const rows = db.prepare('SELECT name, email, driver_phone, driver_plate FROM users WHERE (driver_phone IS NOT NULL AND driver_phone != "") OR (driver_plate IS NOT NULL AND driver_plate != "")').all();

console.log('Total matches:', rows.length);
rows.forEach(row => {
    console.log(`- ${row.name} (${row.email}): Tel: ${row.driver_phone || 'N/A'}, Plaka: ${row.driver_plate || 'N/A'}`);
});
