import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Muhasebe kayıtlarını listele
export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // pending | received | cancelled | all
        const agency = searchParams.get('agency');
        const days = parseInt(searchParams.get('days') || '30');

        const db = await getDatabase();

        let query = `
            SELECT ae.*, u.name as user_name
            FROM accounting_entries ae
            LEFT JOIN users u ON ae.user_id = u.id
            WHERE ae.user_id = ?
              AND ae.taken_at >= DATETIME('now', '-${days} days')
        `;
        const params: any[] = [user.userId];

        if (status && status !== 'all') {
            query += ` AND ae.payment_status = ?`;
            params.push(status);
        }
        if (agency) {
            query += ` AND ae.agency_name ILIKE ?`;
            params.push(`%${agency}%`);
        }

        query += ` ORDER BY ae.taken_at DESC`;

        const entries = await db.all(query, params);

        // Acente bazlı özet
        const agencySummary = entries.reduce((acc: any, e: any) => {
            const key = e.agency_name || 'Bilinmeyen';
            if (!acc[key]) {
                acc[key] = { agency_name: key, total: 0, pending: 0, received: 0, count: 0 };
            }
            acc[key].count++;
            acc[key].total += e.price_numeric || 0;
            if (e.payment_status === 'pending') acc[key].pending += e.price_numeric || 0;
            if (e.payment_status === 'received') acc[key].received += e.price_numeric || 0;
            return acc;
        }, {});

        return NextResponse.json({
            entries,
            agency_summary: Object.values(agencySummary),
            stats: {
                total_jobs: entries.length,
                total_amount: entries.reduce((s: number, e: any) => s + (e.price_numeric || 0), 0),
                pending_amount: entries.filter((e: any) => e.payment_status === 'pending').reduce((s: number, e: any) => s + (e.price_numeric || 0), 0),
                received_amount: entries.filter((e: any) => e.payment_status === 'received').reduce((s: number, e: any) => s + (e.price_numeric || 0), 0),
                confirmed_jobs: entries.filter((e: any) => e.is_confirmed).length,
            }
        });
    } catch (error: any) {
        console.error('[Accounting GET]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Kayıt güncelle (ödeme durumu / onay)
export async function PATCH(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, payment_status, is_confirmed, notes } = await request.json();
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const db = await getDatabase();

        // Güvenlik: sadece kendi kaydını güncelleyebilir
        const entry = await db.get('SELECT id FROM accounting_entries WHERE id = ? AND user_id = ?', [id, user.userId]);
        if (!entry) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });

        const updates: string[] = [];
        const params: any[] = [];

        if (payment_status !== undefined) {
            updates.push('payment_status = ?');
            params.push(payment_status);
            if (payment_status === 'received') {
                updates.push('payment_received_at = NOW()');
            }
        }
        if (is_confirmed !== undefined) {
            updates.push('is_confirmed = ?');
            params.push(is_confirmed);
        }
        if (notes !== undefined) {
            updates.push('notes = ?');
            params.push(notes);
        }

        if (updates.length === 0) return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });

        params.push(id);
        await db.run(`UPDATE accounting_entries SET ${updates.join(', ')} WHERE id = ?`, params);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Accounting PATCH]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Kayıt sil
export async function DELETE(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const db = await getDatabase();
        await db.run('DELETE FROM accounting_entries WHERE id = ? AND user_id = ?', [id, user.userId]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
