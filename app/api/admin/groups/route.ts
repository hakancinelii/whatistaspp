import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { getSession, getActiveSession } from '@/lib/whatsapp';

export const dynamic = "force-dynamic";

// Keşfedilen grupları listele
export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();
        const groups = await db.all(`
            SELECT gd.*, u.email as found_by 
            FROM group_discovery gd
            LEFT JOIN users u ON gd.found_by_user_id = u.id
            ORDER BY gd.created_at DESC
        `);

        // Adminin bağlı olduğu grupları çek
        let participatingGroups: any = {};
        try {
            const session = await getActiveSession(user.userId);
            if (session?.sock?.groupFetchAllParticipating) {
                participatingGroups = await session.sock.groupFetchAllParticipating();
            }
        } catch (e) {
            console.warn("[Group API] Could not fetch participating groups:", e);
        }

        // Grupları işle ve durum ekle
        const processedGroups = groups.map((g: any) => {
            let is_joined = false;

            // Eğer veritabanında JID kayıtlıysa ve adminin listesinde varsa
            if (g.group_jid && participatingGroups[g.group_jid]) {
                is_joined = true;
            }
            // Eğer JID yoksa ama invite_code biliniyorsa, admin listesindeki invite code'larla eşleştirmek zor.
            // Ancak, admin listesindeki Subject (grup adı) ile veritabanındaki group_name eşleşebilir (riskli ama ipucu verir)
            else if (g.group_name) {
                const match = Object.values(participatingGroups).find((pg: any) => pg.subject === g.group_name);
                if (match) is_joined = true;
            }

            return { ...g, is_joined };
        });

        return NextResponse.json(processedGroups);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Gruba katıl
export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { code } = await request.json();
        if (!code) return NextResponse.json({ error: 'Invite code required' }, { status: 400 });

        const session = await getActiveSession(user.userId);
        if (!session || !session.sock || !session.isConnected) {
            return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 });
        }

        const result = await session.sock.groupAcceptInvite(code);

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error('[Groups API] Join Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
