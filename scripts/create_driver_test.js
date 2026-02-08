const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const localDir = path.join(process.cwd(), 'data');
const dbPath = path.join(localDir, 'database.db');

console.log('Connecting to database at:', dbPath);

if (!fs.existsSync(dbPath)) {
    console.error('Database file not found at:', dbPath);
    process.exit(1);
}

const db = new Database(dbPath);

async function createDriverUser() {
    const name = "Transfer Test";
    const email = "sofor@test.com";
    const password = "sofortest123";
    const packageType = "driver";

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        // Delete existing if any to avoid unique constraint error
        db.prepare('DELETE FROM users WHERE email = ?').run(email);

        const result = db.prepare(
            'INSERT INTO users (name, email, password, package, role, credits) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(name, email, hashedPassword, packageType, 'user', 5000);

        console.log('User created successfully with ID:', result.lastInsertRowid);

    } catch (e) {
        console.error('Error creating user:', e);
    } finally {
        db.close();
    }
}

createDriverUser();
