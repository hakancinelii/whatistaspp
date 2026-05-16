import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const db = await getDatabase();
        
        // 1. Check if table exists
        const tableCheck = await db.get(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'accounting_entries'
            );
        `);
        
        // 2. Count total rows
        const count = await db.get('SELECT COUNT(*) as count FROM accounting_entries');
        
        // 3. Get last 5 entries (any user)
        const lastEntries = await db.all('SELECT * FROM accounting_entries ORDER BY id DESC LIMIT 5');
        
        return NextResponse.json({
            table_exists: tableCheck?.exists,
            total_count: count?.count,
            last_entries: lastEntries
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
