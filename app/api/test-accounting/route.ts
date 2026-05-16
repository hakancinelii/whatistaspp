import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDatabase();
        
        // Try a manual insert to test
        const testId = 999999 + Math.floor(Math.random() * 1000);
        try {
            await db.run(`
                INSERT INTO accounting_entries 
                (user_id, job_id, agency_name, from_loc, to_loc, price, price_numeric, is_confirmed, payment_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [user.userId, testId, 'TEST AGENT', 'TEST FROM', 'TEST TO', '1000 TL', 1000, false, 'pending']);
            
            const lastEntry = await db.get('SELECT * FROM accounting_entries WHERE job_id = ?', [testId]);
            
            return NextResponse.json({
                success: true,
                message: 'Test entry created',
                entry: lastEntry,
                user_id: user.userId
            });
        } catch (insertErr: any) {
            return NextResponse.json({
                success: false,
                error: insertErr.message,
                sql_tried: 'INSERT INTO accounting_entries ...'
            });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
