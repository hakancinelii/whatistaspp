const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Read .env.local manually since we are running a simple script
const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const jwtSecretMatch = envContent.match(/JWT_SECRET=(.*)/);
const JWT_SECRET = jwtSecretMatch ? jwtSecretMatch[1].trim() : 'whatistaspp-super-secret-key-change-in-production-2024';

const adminToken = jwt.sign(
    {
        userId: 1,
        email: 'admin@whatistaspp.com',
        role: 'admin',
        credits: 999999,
        package: 'platinum',
        status: 'active'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
);

console.log('Admin Token:');
console.log(adminToken);
