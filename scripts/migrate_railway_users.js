const { Pool } = require('pg');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

async function migrateUsers() {
    const postgresUrl = 'postgresql://postgres:oSJAXDdWxESIirfQmVYzOwxscWgKTTQx@gondola.proxy.rlwy.net:22849/railway';
    const sqlitePath = '/Users/hakancineli/whatistaspp/data/database.db';

    console.log('🔄 Railway PostgreSQL bağlantısı kuruluyor...');
    const pool = new Pool({ connectionString: postgresUrl });
    const sqlite = new Database(sqlitePath);

    try {
        // PostgreSQL'den kullanıcıları çek
        console.log('📥 Kullanıcılar çekiliyor...');
        const { rows: users } = await pool.query('SELECT name, email, password, role, package, status, credits, plain_password, driver_phone, driver_plate FROM users');
        console.log(`✅ ${users.length} kullanıcı bulundu.`);

        const insert = sqlite.prepare(`
            INSERT OR REPLACE INTO users 
            (name, email, password, role, package, status, credits, plain_password, driver_phone, driver_plate) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let count = 0;
        const transaction = sqlite.transaction((userData) => {
            for (const user of userData) {
                insert.run(
                    user.name,
                    user.email,
                    user.password,
                    user.role || 'user',
                    user.package || 'standard',
                    user.status || 'active',
                    user.credits || 0,
                    user.plain_password || null,
                    user.driver_phone || null,
                    user.driver_plate || null
                );
                count++;
            }
        });

        transaction(users);
        console.log(`🚀 ${count} kullanıcı başarıyla yerel veritabanına aktarıldı!`);

    } catch (error) {
        console.error('❌ Hata:', error.message);
    } finally {
        await pool.end();
        sqlite.close();
    }
}

migrateUsers();
