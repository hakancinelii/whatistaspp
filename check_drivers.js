
const { getDatabase } = require('./lib/db');

async function checkDrivers() {
    try {
        const db = await getDatabase();
        const users = await db.all('SELECT name, email, driver_phone, driver_plate FROM users WHERE driver_phone IS NOT NULL OR driver_plate IS NOT NULL');
        console.log('--- Profil Bilgisi Dolduran Şoförler ---');
        if (users.length === 0) {
            console.log('Henüz kimse profil bilgilerini doldurmamış.');
        } else {
            users.forEach(u => {
                console.log(`İsim: ${u.name} | E-posta: ${u.email} | Tel: ${u.driver_phone || '-'} | Plaka: ${u.driver_plate || '-'}`);
            });
        }
    } catch (e) {
        console.error('Hata:', e.message);
    }
}

checkDrivers();
