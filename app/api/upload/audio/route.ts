import { NextRequest, NextResponse } from 'next/server';
import { corsJson, corsPreflight, publicUrl } from '@/lib/cors';
import { getUserFromToken } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return corsJson(request, { error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('audio') as File;

        if (!file) {
            return corsJson(request, { error: 'No audio file found' }, { status: 400 });
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

        const uploadPath = `/uploads/audio/${fileName}`;
        return corsJson(request, { url: publicUrl(uploadPath), path: uploadPath });
    } catch (error: any) {
        console.error('Audio upload error:', error);
        return corsJson(request, { error: 'Upload failed' }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    return corsPreflight(request);
}
