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
        const file = formData.get('image') as File;

        if (!file) {
            return corsJson(request, { error: 'No image file found' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'images');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${user.userId}_sent.${ext}`;
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);

        const uploadPath = `/uploads/images/${fileName}`;
        return corsJson(request, { url: publicUrl(uploadPath), path: uploadPath });
    } catch (error: any) {
        console.error('Image upload error:', error);
        return corsJson(request, { error: 'Upload failed' }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    return corsPreflight(request);
}
