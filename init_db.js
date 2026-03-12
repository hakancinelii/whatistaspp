const Database = require('better-sqlite3');
const db = new Database('./data/database.db');
db.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, plain_password TEXT, role TEXT DEFAULT 'user', credits INTEGER DEFAULT 0, package TEXT DEFAULT 'standard', status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, phone_number TEXT, name TEXT, tags TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS whatsapp_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, session_id TEXT, is_connected BOOLEAN DEFAULT 0, qr_code TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS group_discovery (id INTEGER PRIMARY KEY AUTOINCREMENT, invite_code TEXT UNIQUE, invite_link TEXT, group_name TEXT, group_jid TEXT, found_by_user_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
`);
console.log('✅ Ana tablolar başarıyla oluşturuldu.');
