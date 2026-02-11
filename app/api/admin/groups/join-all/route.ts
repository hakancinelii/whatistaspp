import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { getSession, getActiveSession } from '@/lib/whatsapp';

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDatabase();
        // Sadece JID'si olmayan ve henüz katılınmamış (id ile kontrol edemeyiz, jid ile ederiz) grupları alalım
        // Ama "join-all" butonu kullanıcının isteği, hepsini denemekte fayda var.
        const groups = await db.all('SELECT id, invite_code, invite_link, group_jid FROM group_discovery');

        if (!groups || groups.length === 0) {
            return NextResponse.json({ message: 'No groups found to join' });
        }

        const session = await getActiveSession(user.userId);
        if (!session || !session.sock || !session.isConnected) {
            return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 });
        }

        // Adminin mevcut gruplarını alıp, halihazırda üye olduklarını eleyelim (zaman kazanmak için)
        let participatingJids = new Set();
        try {
            const parts = await session.sock.groupFetchAllParticipating();
            participatingJids = new Set(Object.keys(parts));
        } catch (e) {
            console.warn("Could not fetch participating groups, proceeding blindly.");
        }

        const stats = {
            total: groups.length,
            success: 0,
            already_joined: 0,
            failed: 0,
            details: [] as any[]
        };

        for (const group of groups) {
            // Eğer veritabanında JID varsa ve zaten üyeysek, geç
            if (group.group_jid && participatingJids.has(group.group_jid)) {
                stats.already_joined++;
                continue;
            }

            try {
                let code = group.invite_code;
                if (!code && group.invite_link) {
                    const match = group.invite_link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{20,})/);
                    if (match) code = match[1];
                }

                if (code) {
                    // Gruba katıl
                    const jid = await session.sock.groupAcceptInvite(code);

                    if (jid) {
                        stats.success++;
                        // JID'yi veritabanına kaydet
                        await db.run('UPDATE group_discovery SET group_jid = ? WHERE id = ?', [jid, group.id]);
                        stats.details.push({ code, status: 'joined', jid });
                    } else {
                        // JID dönmediyse belki zaten üyeyizdir
                        // invite info almayı dene
                        try {
                            const meta = await session.sock.groupGetInviteInfo(code);
                            if (meta && meta.id) {
                                const myJid = session.sock?.user?.id?.split(':')[0];
                                const isParticipant = myJid ? meta.participants?.some((p: any) => p.id?.includes(myJid)) : false;

                                // Ya da basitçe JID'yi kaydet
                                await db.run('UPDATE group_discovery SET group_jid = ? WHERE id = ?', [meta.id, group.id]);

                                // Eğer admin listesinde varsa zaten joined say
                                if (participatingJids.has(meta.id)) {
                                    stats.already_joined++;
                                } else {
                                    stats.success++; // Metadata alabildiysek başarılı sayabiliriz (invite code geçerli)
                                }
                            }
                        } catch (metaErr) {
                            stats.failed++;
                            stats.details.push({ code, status: 'failed_metadata', error: String(metaErr) });
                        }
                    }

                    // Rate limiting
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    stats.failed++;
                    stats.details.push({ link: group.invite_link, status: 'no_code_found' });
                }
            } catch (err: any) {
                // Zaten üye hatası
                if (err.message && (err.message.includes('already-in-group') || err.message.includes('409'))) {
                    stats.already_joined++;
                    // JID'yi bulup kaydetmeye çalış (tekrar)
                    try {
                        let code = group.invite_code;
                        if (!code && group.invite_link) {
                            const match = group.invite_link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{20,})/);
                            if (match) code = match[1];
                        }
                        if (code) {
                            const meta = await session.sock.groupGetInviteInfo(code);
                            if (meta && meta.id) {
                                await db.run('UPDATE group_discovery SET group_jid = ? WHERE id = ?', [meta.id, group.id]);
                            }
                        }
                    } catch (e) { }

                } else {
                    console.error(`[Join All] Failed for group ${group.id}:`, err);
                    stats.failed++;
                    stats.details.push({ id: group.id, error: err.message, status: 'failed' });
                }
            }
        }

        return NextResponse.json({ success: true, stats });
    } catch (error: any) {
        console.error('[Groups API] Join All Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
