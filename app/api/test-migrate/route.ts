import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, runMigrations } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        console.log('[DEBUG] Manually triggering migrations...');
        await runMigrations();
        
        const db = await getDatabase();
        const testId = 888888 + Math.floor(Math.random() * 1000);
        
        await db.run(`
            INSERT INTO accounting_entries 
            (user_id, job_id, agency_name, from_loc, to_loc, price, price_numeric, is_confirmed, payment_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [1, testId, 'MANUAL MIGRATE TEST', 'FROM', 'TO', '500 TL', 500, false, 'pending']);
        
        const entry = await db.get('SELECT * FROM accounting_entries WHERE job_id = ?', [testId]);
        
        return NextResponse.json({
            success: true,
            entry
        });
    } catch (error: any) {
        return NextResponse.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
