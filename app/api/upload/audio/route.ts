import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('audio') as File;

        if (!file) {
            return NextResponse.json({ error: 'No audio file found' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'audio');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        // Determine extension based on mimetype
        let ext = 'ogg';
        if (file.type.includes('webm')) ext = 'webm';
        else if (file.type.includes('mp4')) ext = 'mp4';
        else if (file.type.includes('aac')) ext = 'aac';

        console.log(`[Upload] Saving audio: type=${file.type}, ext=${ext}`);

        const fileName = `${Date.now()}_${user.userId}_sent.${ext}`;
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);

        const url = `/uploads/audio/${fileName}`;
        return NextResponse.json({ url });
    } catch (error: any) {
        console.error('Audio upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
