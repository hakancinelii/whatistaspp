const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'data', 'database.db');
const db = new Database(dbPath);

console.log('--- Database Migration Started ---');

// 1. Update users table
try {
    db.prepare("ALTER TABLE users ADD COLUMN package TEXT DEFAULT 'standard'").run();
    console.log('Added package column to users');
} catch (e) {
    console.log('Package column already exists or error:', e.message);
}

// 2. Create missing tables
const schema = `
    CREATE TABLE IF NOT EXISTS auto_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        keyword TEXT NOT NULL,
        reply TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS knowledge_base (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        license_plate TEXT,
        vehicle_type TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        driver_id INTEGER,
        driver_phone TEXT,
        voucher_number TEXT UNIQUE NOT NULL,
        type TEXT DEFAULT 'transfer',
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        pickup_location TEXT NOT NULL,
        dropoff_location TEXT NOT NULL,
        flight_code TEXT,
        passenger_count INTEGER DEFAULT 1,
        passenger_names TEXT, -- JSON array of names
        price REAL,
        currency TEXT DEFAULT 'TRY',
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (driver_id) REFERENCES drivers(id)
    );
`;

try {
    db.exec(schema);
    console.log('Created missing tables (auto_replies, knowledge_base, drivers, reservations)');
} catch (e) {
    console.log('Error creating tables:', e.message);
}

// 3. Set admin to Platinum
try {
    const admin = db.prepare("SELECT id FROM users WHERE email = 'admin@whatistaspp.com' OR role = 'admin' LIMIT 1").get();
    if (admin) {
        db.prepare("UPDATE users SET package = 'platinum', credits = 999999 WHERE id = ?").run(admin.id);
        console.log(`User ID ${admin.id} upgraded to PLATINUM with unlimited credits.`);
    } else {
        console.log('Admin user not found to upgrade.');
    }
} catch (e) {
    console.log('Error upgrading admin:', e.message);
}

console.log('--- Migration Finished ---');
db.close();
