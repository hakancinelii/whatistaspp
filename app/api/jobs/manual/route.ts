import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export const dynamic = "force-dynamic";

// Manuel iş ekleme
export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { from_loc, to_loc, price, time, description, contact_phone } = body;

        if (!from_loc || !to_loc || !price || !contact_phone) {
            return NextResponse.json({ error: 'Eksik bilgi: Nereden, Nereye, Fiyat ve İletişim numarası zorunludur.' }, { status: 400 });
        }

        const db = await getDatabase();

        // Raw message oluştur (Görünüm için)
        const raw_message = `${description ? description + ' - ' : ''}${from_loc} > ${to_loc} - ${price} - ${time || 'Hemen'} #MANUEL`;

        // captured_jobs tablosuna ekle
        // group_jid null olacak, bu sayede manuel olduğunu anlayabiliriz veya 'MANUEL' yazabiliriz.
        // sender_jid olarak ekleyen kullanıcının ID'sini veya telefonunu koyalım.
        const result = await db.run(`
            INSERT INTO captured_jobs (
                user_id, 
                group_jid, 
                sender_jid, 
                from_loc, 
                to_loc, 
                price, 
                phone, 
                raw_message, 
                time, 
                status,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now', 'localtime'))
        `, [
            user.userId,
            'MANUEL', // Grup JID yerine MANUEL etiketi
            user.userId.toString(), // Sender JID yerine User ID
            from_loc.toUpperCase(),
            to_loc.toUpperCase(),
            price,
            contact_phone,
            raw_message,
            time ? time.toUpperCase() : 'HEMEN'
        ]);

        return NextResponse.json({ success: true, id: result.lastID });

    } catch (error: any) {
        console.error('[Manual Job API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
