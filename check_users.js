
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

(async () => {
    try {
        const db = await open({
            filename: path.join(__dirname, 'database.db'),
            driver: sqlite3.Database
        });

        const users = await db.all('SELECT id, name, email, role, credits FROM users');
        console.log('Mevcut Kullanıcılar:');
        console.table(users);

        if (users.length > 0) {
            console.log('\nAdmin yapmak için şu komutu çalıştırabilirsiniz:');
            console.log(`node scripts/make_admin.js "${users[0].email}"`);
        }
    } catch (err) {
        console.error(err);
    }
})();
