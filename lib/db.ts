import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let dbInstance: any = null;

function getDbPath() {
  // Railway'de volume /app/data'dır. Eğer bu klasör varsa mutlaka orayı kullan.
  const railwayPath = '/app/data/database.db';
  if (fs.existsSync('/app/data')) {
    return railwayPath;
  }

  // Yerel geliştirme için
  const localDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  return path.join(localDir, 'database.db');
}

function initDatabase(): any {
  if (dbInstance) return dbInstance;

  const dbPath = getDbPath();
  console.log(`[DB] Using Database at: ${dbPath}`);

  const rawDb = new Database(dbPath);
  rawDb.pragma('journal_mode = WAL');
  rawDb.pragma('synchronous = NORMAL');
  rawDb.pragma('busy_timeout = 30000'); // 30 saniye bekleme süresi

  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        credits INTEGER DEFAULT 0,
        package TEXT DEFAULT 'standard',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_id TEXT UNIQUE NOT NULL,
        is_connected BOOLEAN DEFAULT 0,
        qr_code TEXT,
        last_connected DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS auto_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        keyword TEXT NOT NULL,
        reply TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        phone_number TEXT NOT NULL,
        name TEXT,
        tags TEXT,
        is_archived BOOLEAN DEFAULT 0,
        profile_picture_url TEXT,
        status TEXT,
        additional_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, phone_number)
    );

    CREATE TABLE IF NOT EXISTS scheduled_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        customer_ids TEXT NOT NULL, -- JSON string of contact IDs
        message TEXT NOT NULL,
        scheduled_at DATETIME NOT NULL,
        status TEXT DEFAULT 'pending', -- pending, sent, failed, cancelled
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sent_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        phone_number TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        media_url TEXT,
        media_type TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS message_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS knowledge_base (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text', -- text, pdf_parsed, etc.
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );



    CREATE TABLE IF NOT EXISTS incoming_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        phone_number TEXT NOT NULL,
        message TEXT NOT NULL,
        received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
        type TEXT DEFAULT 'transfer', -- transfer, tour, hotel
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        pickup_location TEXT NOT NULL,
        dropoff_location TEXT NOT NULL,
        flight_code TEXT,
        passenger_count INTEGER DEFAULT 1,
        passenger_names TEXT,
        price REAL,
        currency TEXT DEFAULT 'TRY',
        status TEXT DEFAULT 'pending', -- pending, confirmed, active, completed, cancelled
        payment_status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (driver_id) REFERENCES drivers(id)
    );

    CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        webhook_url TEXT,
        api_key TEXT UNIQUE,
        min_delay INTEGER DEFAULT 5,
        max_delay INTEGER DEFAULT 10,
        daily_limit INTEGER DEFAULT 250,
        night_mode BOOLEAN DEFAULT 1,
        message_variation BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS captured_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        group_jid TEXT,
        sender_jid TEXT,
        from_loc TEXT,
        to_loc TEXT,
        price TEXT,
        phone TEXT,
        raw_message TEXT,
        status TEXT DEFAULT 'pending', -- pending, called, ignored
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Migrations for existing databases
  try {
    rawDb.exec("ALTER TABLE customers ADD COLUMN is_archived BOOLEAN DEFAULT 0;");
    console.log("[DB] Migration: Added is_archived to customers");
  } catch (e: any) { }

  try {
    rawDb.exec("ALTER TABLE customers ADD COLUMN profile_picture_url TEXT;");
    rawDb.exec("ALTER TABLE customers ADD COLUMN status TEXT;");
    console.log("[DB] Migration: Added profile columns to customers");
  } catch (e: any) { }

  try {
    rawDb.exec("ALTER TABLE reservations ADD COLUMN driver_phone TEXT;");
    console.log("[DB] Migration: Added driver_phone to reservations");
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error("[DB] Migration Error (driver_phone):", e.message);
    }
  }

  try {
    rawDb.exec("ALTER TABLE reservations ADD COLUMN passenger_names TEXT;");
    console.log("[DB] Migration: Added passenger_names to reservations");
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error("[DB] Migration Error (passenger_names):", e.message);
    }
  }

  try {
    rawDb.exec("ALTER TABLE reservations ADD COLUMN passenger_names TEXT;");
    console.log("[DB] Migration: Added passenger_names to reservations");
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error("[DB] Migration Error (passenger_names):", e.message);
    }
  }

  // Users Migration
  try {
    rawDb.exec("ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 0;");
    console.log("[DB] Migration: Added credits to users");
  } catch (e: any) { }

  try {
    rawDb.exec("ALTER TABLE users ADD COLUMN package TEXT DEFAULT 'standard';");
    console.log("[DB] Migration: Added package to users");
  } catch (e: any) { }

  // Captured Jobs Migration
  try {
    rawDb.exec(`
            CREATE TABLE IF NOT EXISTS captured_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                group_jid TEXT,
                from_loc TEXT,
                to_loc TEXT,
                price TEXT,
                phone TEXT,
                raw_message TEXT,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        `);
    console.log("[DB] Migration: Ensured captured_jobs table exists");
  } catch (e: any) {
    console.error("[DB] Migration Error (captured_jobs):", e.message);
  }

  try {
    rawDb.exec("ALTER TABLE customers ADD COLUMN lid TEXT;");
    console.log("[DB] Migration: Added lid to customers");
  } catch (e: any) { }

  try {
    rawDb.exec("ALTER TABLE captured_jobs ADD COLUMN sender_jid TEXT;");
    console.log("[DB] Migration: Added sender_jid to captured_jobs");
  } catch (e: any) { }

  try {
    rawDb.exec("ALTER TABLE captured_jobs ADD COLUMN completed_at DATETIME;");
    console.log("[DB] Migration: Added completed_at to captured_jobs");
  } catch (e: any) { }

  try {
    rawDb.exec("ALTER TABLE user_settings ADD COLUMN min_delay INTEGER DEFAULT 5;");
    rawDb.exec("ALTER TABLE user_settings ADD COLUMN max_delay INTEGER DEFAULT 10;");
    rawDb.exec("ALTER TABLE user_settings ADD COLUMN night_mode BOOLEAN DEFAULT 1;");
  } catch (e: any) { }

  try {
    rawDb.exec("ALTER TABLE captured_jobs ADD COLUMN time TEXT;");
    console.log("[DB] Migration: Added time to captured_jobs");
  } catch (e: any) { }

  try {
    rawDb.exec("ALTER TABLE captured_jobs ADD COLUMN group_name TEXT;");
    console.log("[DB] Migration: Added group_name to captured_jobs");
  } catch (e: any) { }

  try {
    rawDb.exec("ALTER TABLE users ADD COLUMN plain_password TEXT;");
    console.log("[DB] Migration: Added plain_password to users");
  } catch (e: any) { }

  try {
    rawDb.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_id ON whatsapp_sessions(user_id);");
    console.log("[DB] Migration: Ensured unique user_id in whatsapp_sessions");
  } catch (e: any) { }

  try {
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS group_discovery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invite_code TEXT UNIQUE,
        invite_link TEXT,
        group_name TEXT,
        found_by_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[DB] Migration: Created group_discovery table");
  } catch (e: any) { }

  try {
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS driver_filters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        regions TEXT, -- JSON array of strings
        min_price INTEGER DEFAULT 0,
        job_mode TEXT DEFAULT 'all', -- all, ready, scheduled
        action_mode TEXT DEFAULT 'manual', -- manual, auto
        rota_name TEXT DEFAULT 'ROTA 1',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log("[DB] Migration: Created driver_filters table");
  } catch (e: any) { }

  try {
    rawDb.exec(`ALTER TABLE driver_filters ADD COLUMN rota_name TEXT DEFAULT 'ROTA 1'`);
  } catch (e: any) { }

  try {
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS job_interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        status TEXT NOT NULL, -- called, ignored, won
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, job_id)
      )
    `);
    console.log("[DB] Migration: Created job_interactions table");
  } catch (e: any) { }

  try {
    rawDb.exec("ALTER TABLE captured_jobs ADD COLUMN is_high_reward BOOLEAN DEFAULT 0;");
    rawDb.exec("ALTER TABLE captured_jobs ADD COLUMN is_swap BOOLEAN DEFAULT 0;");
    console.log("[DB] Migration: Added is_high_reward and is_swap to captured_jobs");
  } catch (e: any) { }

  // Şoför bilgileri için users tablosuna alanlar
  try {
    rawDb.exec("ALTER TABLE users ADD COLUMN driver_phone TEXT;");
    console.log("[DB] Migration: Added driver_phone to users");
  } catch (e: any) { }

  try {
    rawDb.exec("ALTER TABLE users ADD COLUMN driver_plate TEXT;");
    console.log("[DB] Migration: Added driver_plate to users");
  } catch (e: any) { }

  // Admin ayarı: Proxy mesaj modu
  try {
    rawDb.exec("ALTER TABLE user_settings ADD COLUMN proxy_message_mode BOOLEAN DEFAULT 0;");
    console.log("[DB] Migration: Added proxy_message_mode to user_settings");
  } catch (e: any) { }

  dbInstance = rawDb;
  return rawDb;
}

export async function getDatabase(): Promise<any> {
  const rawDb = initDatabase();

  return {
    get: async (sql: string, params: any[] = []) => rawDb.prepare(sql).get(...params),
    all: async (sql: string, params: any[] = []) => rawDb.prepare(sql).all(...params),
    run: async (sql: string, params: any[] = []) => {
      const result = rawDb.prepare(sql).run(...params);
      return { lastID: Number(result.lastInsertRowid), changes: result.changes };
    },
    exec: async (sql: string) => {
      rawDb.exec(sql);
    },
    prepare: (sql: string) => rawDb.prepare(sql)
  };
}
