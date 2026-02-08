import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const secret = searchParams.get('secret');

    // Basit bir güvenlik kontrolü
    if (secret !== 'hakan123') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!email) {
        return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    try {
        const db = await getDatabase();
        const result = await db.run(
            "UPDATE users SET package = 'driver', credits = 9999 WHERE email = ?",
            [email]
        );

        if (result.changes > 0) {
            return NextResponse.json({ success: true, message: `${email} upgraded to Driver package.` });
        } else {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
