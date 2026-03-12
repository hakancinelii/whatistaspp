const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(process.cwd(), 'data', 'database.db');
console.log("Updating Database at:", dbPath);
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Creating missing tables if they don't exist...");

    db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            plain_password TEXT,
            role TEXT DEFAULT 'driver',
            package TEXT DEFAULT 'free',
            status TEXT DEFAULT 'active',
            credits INTEGER DEFAULT 0,
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS group_discovery (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invite_code TEXT UNIQUE,
            invite_link TEXT,
            group_name TEXT,
            group_jid TEXT,
            found_by_user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_heartbeat (
            user_id INTEGER PRIMARY KEY REFERENCES users(id),
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS job_interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            job_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, job_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS external_drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            plate TEXT,
            vehicle_type TEXT,
            notes TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS driver_filters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
            regions TEXT,
            to_regions TEXT,
            min_price INTEGER DEFAULT 0,
            job_mode TEXT DEFAULT 'all',
            action_mode TEXT DEFAULT 'manual',
            rota_name TEXT DEFAULT 'ROTA 1',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS captured_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            instance_id TEXT,
            group_jid TEXT,
            group_name TEXT,
            sender_jid TEXT,
            from_loc TEXT,
            to_loc TEXT,
            price TEXT,
            phone TEXT,
            raw_message TEXT,
            status TEXT DEFAULT 'pending',
            is_high_reward BOOLEAN DEFAULT 0,
            is_swap BOOLEAN DEFAULT 0,
            completed_at DATETIME,
            time TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log("Ensuring Super Admin account hakan34.");
    const hashedPw = bcrypt.hashSync('Hakan34.', 10);

    // Önce var mı diye bakalım, yoksa ekleyelim
    db.get("SELECT id FROM users WHERE email = 'hakancineli@gmail.com'", (err, row) => {
        if (!row) {
            db.run("INSERT INTO users (name, email, password, plain_password, role, package, status, credits) VALUES ('Hakan Cineli', 'hakancineli@gmail.com', ?, 'Hakan34.', 'admin', 'platinum', 'active', 999999)", [hashedPw]);
        } else {
            db.run("UPDATE users SET password = ?, plain_password = 'Hakan34.', role = 'admin', package = 'platinum', credits = 999999 WHERE email = 'hakancineli@gmail.com'", [hashedPw]);
        }
    });
});

db.close(() => {
    console.log("✅ Database successfully updated. You can go back to the browser!");
});
