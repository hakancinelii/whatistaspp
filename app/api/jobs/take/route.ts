import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { processJobTaking } from '@/lib/job_service';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { jobId, groupJid, phone, externalDriverId } = await request.json();

        const result = await processJobTaking(user.userId, jobId, groupJid, phone, externalDriverId);

        return NextResponse.json({
            success: true,
            message: result.isUsingProxy ? 'İş sahiplenildi (Admin WhatsApp üzerinden)' : 'İş sahiplenildi.'
        });
    } catch (error: any) {
        console.error('[API Take Job Global Error]', error);
        return NextResponse.json({ error: error.message || 'Sistem hatası' }, { status: 500 });
    }
}
