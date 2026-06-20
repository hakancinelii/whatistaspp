// Force redeploy for Postgres migration - Heartbeat 1
import { Pool } from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let dbInstance: any = null;
let pgPool: Pool | null = null;

// Determine if we should use PostgreSQL (Production) or SQLite (Local)
export const isPostgres = !!process.env.DATABASE_URL;

function getDbPath() {
  const railwayPath = '/app/data/database.db';
  if (fs.existsSync('/app/data')) {
    return railwayPath;
  }
  const localDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  return path.join(localDir, 'database.db');
}

let isMigrated = false;

async function initDatabase(): Promise<any> {
  if (dbInstance) return dbInstance;

  if (isPostgres) {
    console.log('[DB] Using PostgreSQL at: ' + process.env.DATABASE_URL?.split('@')[1]); // Log host only for safety
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    if (!isMigrated) {
      await runMigrations().catch(err => console.error("[DB] Migration Error:", err));
      isMigrated = true;
    }

    dbInstance = pgPool;
    return dbInstance;
  } else {
    const dbPath = getDbPath();
    console.log(`[DB] Using SQLite at: ${dbPath}`);
    const rawDb = new Database(dbPath);
    rawDb.pragma('journal_mode = WAL');
    rawDb.pragma('synchronous = NORMAL');
    rawDb.pragma('busy_timeout = 30000');
    runSqliteMigrations(rawDb);
    dbInstance = rawDb;
    return dbInstance;
  }
}

function runSqliteMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      phone_number TEXT NOT NULL,
      name TEXT,
      tags TEXT,
      lid TEXT,
      is_archived BOOLEAN DEFAULT 0,
      profile_picture_url TEXT,
      status TEXT,
      additional_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, phone_number)
    );

    CREATE TABLE IF NOT EXISTS incoming_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      phone_number TEXT NOT NULL,
      name TEXT,
      content TEXT,
      media_url TEXT,
      media_type TEXT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      phone_number TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      media_url TEXT,
      media_type TEXT,
      job_id INTEGER,
      customer_id INTEGER,
      queue_index INTEGER,
      is_read BOOLEAN DEFAULT 0,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      scheduled_at DATETIME NOT NULL,
      status TEXT DEFAULT 'pending',
      recipients TEXT NOT NULL,
      media_url TEXT,
      media_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      license_plate TEXT,
      vehicle_type TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      passenger_names TEXT,
      price REAL,
      currency TEXT DEFAULT 'TRY',
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS job_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, job_id)
    );

    CREATE TABLE IF NOT EXISTS accounting_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      job_id INTEGER,
      agency_name TEXT,
      agency_group_jid TEXT,
      from_loc TEXT,
      to_loc TEXT,
      price TEXT,
      price_numeric INTEGER DEFAULT 0,
      contact_phone TEXT,
      job_time TEXT,
      taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_confirmed BOOLEAN DEFAULT 0,
      payment_status TEXT DEFAULT 'pending',
      payment_received_at DATETIME,
      notes TEXT
    );
  `);

  const addColumn = (table: string, column: string, definition: string) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some(col => col.name === column)) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    }
  };

  addColumn('customers', 'lid', 'TEXT');
  addColumn('customers', 'is_archived', 'BOOLEAN DEFAULT 0');
  addColumn('customers', 'profile_picture_url', 'TEXT');
  addColumn('customers', 'status', 'TEXT');
  addColumn('customers', 'additional_data', 'TEXT');
  addColumn('incoming_messages', 'media_url', 'TEXT');
  addColumn('incoming_messages', 'media_type', 'TEXT');
  addColumn('incoming_messages', 'is_read', 'BOOLEAN DEFAULT 0');
  addColumn('sent_messages', 'media_url', 'TEXT');
  addColumn('sent_messages', 'media_type', 'TEXT');
  addColumn('sent_messages', 'job_id', 'INTEGER');
  addColumn('sent_messages', 'customer_id', 'INTEGER');
  addColumn('sent_messages', 'queue_index', 'INTEGER');
  addColumn('sent_messages', 'is_read', 'BOOLEAN DEFAULT 0');
  addColumn('scheduled_messages', 'media_url', 'TEXT');
  addColumn('scheduled_messages', 'media_type', 'TEXT');
  addColumn('reservations', 'driver_phone', 'TEXT');
  addColumn('reservations', 'type', "TEXT DEFAULT 'transfer'");
  addColumn('reservations', 'flight_code', 'TEXT');
  addColumn('reservations', 'passenger_count', 'INTEGER DEFAULT 1');
  addColumn('reservations', 'passenger_names', 'TEXT');
  addColumn('reservations', 'price', 'REAL');
  addColumn('reservations', 'currency', "TEXT DEFAULT 'TRY'");
  addColumn('reservations', 'payment_status', "TEXT DEFAULT 'pending'");
  addColumn('reservations', 'notes', 'TEXT');
  // Grupta orijinal iş mesajına "alıntı/cevap" (reply) ile OK atabilmek için mesaj kimliği
  addColumn('captured_jobs', 'message_id', 'TEXT');
}

// Convert SQLite compatible SQL to PostgreSQL compatible SQL
function convertSql(sql: string): string {
  if (!isPostgres) return sql;

  let converted = sql
    .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    .replace(/DATETIME\('now', '-(.*?)'\)/gi, (match, interval) => {
      // Convert datetime('now', '-1 day') -> NOW() - INTERVAL '${interval}'
      return `NOW() - INTERVAL '${interval}'`;
    })
    .replace(/DATETIME\('now'\)/gi, 'NOW()')
    .replace(/DATETIME/gi, 'TIMESTAMP')
    .replace(/REAL/gi, 'DECIMAL')
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');

  // Handle INSERT OR IGNORE
  if (converted.toUpperCase().includes('INSERT OR IGNORE INTO')) {
    converted = converted.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');
    if (!converted.toUpperCase().includes('ON CONFLICT')) {
      converted += ' ON CONFLICT DO NOTHING';
    }
  }

  // Convert ? to $n
  return converted.replace(/\?/g, (match, offset, string) => {
    let count = 0;
    let insideString = false;
    for (let i = 0; i < offset; i++) {
      if (string[i] === "'") insideString = !insideString;
      if (string[i] === '?' && !insideString) count++;
    }
    return insideString ? '?' : `$${count + 1}`;
  });
}

export async function getDatabase(): Promise<any> {
  const db = await initDatabase();

  if (isPostgres) {
    return {
      get: async (sql: string, params: any[] = []) => {
        const res = await pgPool!.query(convertSql(sql), params);
        return res.rows[0];
      },
      all: async (sql: string, params: any[] = []) => {
        const res = await pgPool!.query(convertSql(sql), params);
        return res.rows;
      },
      run: async (sql: string, params: any[] = []) => {
        const pgSql = convertSql(sql);
        // Postgres returns multiple rows for INSERT ... RETURNING id
        // We modify INSERT statements to return ID if it's an insert
        let finalSql = pgSql;
        if (pgSql.trim().toUpperCase().startsWith('INSERT')) {
          finalSql += ' RETURNING id';
        }
        const res = await pgPool!.query(finalSql, params);
        return {
          lastID: res.rows[0]?.id || null,
          changes: res.rowCount
        };
      },
      exec: async (sql: string) => {
        await pgPool!.query(convertSql(sql));
      },
      close: async () => {
        await pgPool!.end();
      }
    };
  }

  // SQLite shim
  return {
    get: async (sql: string, params: any[] = []) => db.prepare(sql).get(...params),
    all: async (sql: string, params: any[] = []) => db.prepare(sql).all(...params),
    run: async (sql: string, params: any[] = []) => {
      const result = db.prepare(sql).run(...params);
      return { lastID: Number(result.lastInsertRowid), changes: result.changes };
    },
    exec: async (sql: string) => {
      db.exec(sql);
    },
    close: async () => {
      db.close();
    }
  };
}

// Global Migration Function for Postgres
export async function runMigrations() {
  if (!isPostgres) return;
  const db = await getDatabase();

  console.log("[DB] Running Postgres Migrations...");

  // Core Tables
  await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            plain_password TEXT,
            role TEXT DEFAULT 'user',
            credits INTEGER DEFAULT 0,
            package TEXT DEFAULT 'standard',
            status TEXT DEFAULT 'active',
            profile_picture TEXT,
            driver_phone TEXT,
            driver_plate TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS whatsapp_sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
            session_id TEXT UNIQUE NOT NULL,
            is_connected BOOLEAN DEFAULT FALSE,
            qr_code TEXT,
            last_connected TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS auto_replies (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            keyword TEXT NOT NULL,
            reply TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS customers (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            phone_number TEXT NOT NULL,
            name TEXT,
            tags TEXT,
            lid TEXT,
            is_archived BOOLEAN DEFAULT FALSE,
            profile_picture_url TEXT,
            status TEXT,
            additional_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, phone_number)
        );

        CREATE TABLE IF NOT EXISTS scheduled_messages (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            content TEXT NOT NULL,
            scheduled_at TIMESTAMP NOT NULL,
            status TEXT DEFAULT 'pending',
            recipients TEXT NOT NULL,
            media_url TEXT,
            media_type TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sent_messages (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            phone_number TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            media_url TEXT,
            media_type TEXT,
            job_id INTEGER,
            customer_id INTEGER,
            queue_index INTEGER,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS message_jobs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            status TEXT DEFAULT 'queued',
            message TEXT,
            media_url TEXT,
            media_type TEXT,
            customer_ids_json TEXT NOT NULL,
            total_count INTEGER DEFAULT 0,
            next_index INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            error_count INTEGER DEFAULT 0,
            daily_cap INTEGER DEFAULT 500,
            last_customer_id INTEGER,
            last_phone_number TEXT,
            last_sent_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP,
            finished_at TIMESTAMP
        );

        ALTER TABLE sent_messages ADD COLUMN IF NOT EXISTS job_id INTEGER;
        ALTER TABLE sent_messages ADD COLUMN IF NOT EXISTS customer_id INTEGER;
        ALTER TABLE sent_messages ADD COLUMN IF NOT EXISTS queue_index INTEGER;
        ALTER TABLE sent_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
        ALTER TABLE scheduled_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
        ALTER TABLE scheduled_messages ADD COLUMN IF NOT EXISTS media_type TEXT;

        CREATE INDEX IF NOT EXISTS idx_message_jobs_user_status ON message_jobs(user_id, status);
        CREATE INDEX IF NOT EXISTS idx_message_jobs_user_updated ON message_jobs(user_id, updated_at);

        CREATE TABLE IF NOT EXISTS message_templates (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS knowledge_base (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            type TEXT DEFAULT 'text',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS incoming_messages (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            phone_number TEXT NOT NULL,
            name TEXT,
            content TEXT,
            media_url TEXT,
            media_type TEXT,
            received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS drivers (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            name TEXT NOT NULL,
            phone_number TEXT NOT NULL,
            license_plate TEXT,
            vehicle_type TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS reservations (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            driver_id INTEGER REFERENCES drivers(id),
            driver_phone TEXT,
            voucher_number TEXT UNIQUE NOT NULL,
            type TEXT DEFAULT 'transfer',
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            pickup_location TEXT NOT NULL,
            dropoff_location TEXT NOT NULL,
            flight_code TEXT,
            passenger_count INTEGER DEFAULT 1,
            passenger_names TEXT,
            price DECIMAL,
            currency TEXT DEFAULT 'TRY',
            status TEXT DEFAULT 'pending',
            payment_status TEXT DEFAULT 'pending',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_settings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
            webhook_url TEXT,
            api_key TEXT UNIQUE,
            min_delay INTEGER DEFAULT 5,
            max_delay INTEGER DEFAULT 10,
            daily_limit INTEGER DEFAULT 250,
            night_mode BOOLEAN DEFAULT TRUE,
            message_variation BOOLEAN DEFAULT TRUE,
            proxy_message_mode BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS captured_jobs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            instance_id TEXT,
            group_jid TEXT,
            group_name TEXT,
            sender_jid TEXT,
            message_id TEXT,
            from_loc TEXT,
            to_loc TEXT,
            price TEXT,
            phone TEXT,
            raw_message TEXT,
            status TEXT DEFAULT 'pending',
            is_high_reward BOOLEAN DEFAULT FALSE,
            is_swap BOOLEAN DEFAULT FALSE,
            completed_at TIMESTAMP,
            time TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS group_discovery (
            id SERIAL PRIMARY KEY,
            invite_code TEXT UNIQUE,
            invite_link TEXT,
            group_name TEXT,
            group_jid TEXT,
            found_by_user_id INTEGER,
            is_left BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE group_discovery ADD COLUMN IF NOT EXISTS is_left BOOLEAN DEFAULT FALSE;

        CREATE TABLE IF NOT EXISTS driver_filters (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
            regions TEXT,
            to_regions TEXT,
            min_price INTEGER DEFAULT 0,
            job_mode TEXT DEFAULT 'all',
            action_mode TEXT DEFAULT 'manual',
            rota_name TEXT DEFAULT 'ROTA 1',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS external_drivers (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            plate TEXT,
            vehicle_type TEXT,
            notes TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS job_interactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            job_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, job_id)
        );

        CREATE TABLE IF NOT EXISTS accounting_entries (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            job_id INTEGER,
            agency_name TEXT,
            agency_group_jid TEXT,
            from_loc TEXT,
            to_loc TEXT,
            price TEXT,
            price_numeric INTEGER DEFAULT 0,
            contact_phone TEXT,
            job_time TEXT,
            taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_confirmed BOOLEAN DEFAULT FALSE,
            payment_status TEXT DEFAULT 'pending',
            payment_received_at TIMESTAMP,
            notes TEXT
        );

        ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT FALSE;
        ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS job_time TEXT;


        CREATE TABLE IF NOT EXISTS user_heartbeat (
            user_id INTEGER PRIMARY KEY REFERENCES users(id),
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            endpoint TEXT UNIQUE NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

  console.log("[DB] Postgres Migrations Completed.");
}
