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
        const file = formData.get('image') as File;

        if (!file) {
            return NextResponse.json({ error: 'No image file found' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'images');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${user.userId}_sent.${ext}`;
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);

        const url = `/uploads/images/${fileName}`;
        return NextResponse.json({ url });
    } catch (error: any) {
        console.error('Image upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
