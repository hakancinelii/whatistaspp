import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { getSession } from '@/lib/whatsapp';

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();
        const groups = await db.all('SELECT invite_code, invite_link FROM group_discovery');

        if (!groups || groups.length === 0) {
            return NextResponse.json({ message: 'No groups found to join' });
        }

        const session = await getSession(user.userId);
        if (!session.sock || !session.isConnected) {
            return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 });
        }

        const stats = {
            total: groups.length,
            success: 0,
            failed: 0,
            details: [] as any[]
        };

        // Gruplara sırayla katılmayı dene
        for (const group of groups) {
            try {
                // Eğer invite_code yoksa linkten çıkarmayı dene (basit regex)
                let code = group.invite_code;
                if (!code && group.invite_link) {
                    const match = group.invite_link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{20,})/);
                    if (match) code = match[1];
                }

                if (code) {
                    await session.sock.groupAcceptInvite(code);
                    stats.success++;
                    stats.details.push({ code, status: 'joined' });
                    // WhatsApp API rate limit yememek için kısa bir bekleme (örn: 1sn)
                    await new Promise(r => setTimeout(r, 1000));
                } else {
                    stats.failed++;
                    stats.details.push({ link: group.invite_link, status: 'no_code_found' });
                }
            } catch (err: any) {
                console.error(`[Join All] Failed for group ${group.invite_code}:`, err);
                // Zaten üye ise başarı sayılabilir veya ignored denebilir
                if (err.message && err.message.includes('already-in-group')) {
                    stats.success++; // Zaten gruptaysak başarılı sayalım
                    stats.details.push({ code: group.invite_code, status: 'already_joined' });
                } else {
                    stats.failed++;
                    stats.details.push({ code: group.invite_code, error: err.message, status: 'failed' });
                }
            }
        }

        return NextResponse.json({ success: true, stats });
    } catch (error: any) {
        console.error('[Groups API] Join All Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
