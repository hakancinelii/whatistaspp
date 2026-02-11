
const { getDatabase } = require('./lib/db');
async function run() {
    const db = await getDatabase();
    try {
        const result = await db.get('SELECT COUNT(*) as count FROM group_discovery');
        console.log('Total groups in group_discovery:', result.count);
    } catch (e) {
        console.log('Error checking group_discovery:', e.message);
    }
}
run();
