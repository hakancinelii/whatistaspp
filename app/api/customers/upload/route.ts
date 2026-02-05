import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromToken(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const formData = await request.formData();
        const file = formData.get('file') as File;
        if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Use header: 1 to get raw rows
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (rows.length === 0) return NextResponse.json({ error: 'Empty file' }, { status: 400 });

        const db = await getDatabase();
        let count = 0;

        // --- Header Analysis ---
        const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
        let phoneIdx = headers.findIndex(h => h.includes('telefon') || h.includes('phone') || h.includes('tel'));
        let nameIdx = headers.findIndex(h => h.includes('isim') || h.includes('ad') || h.includes('name'));

        // If no phone column detected, fallback to column 0
        if (phoneIdx === -1) phoneIdx = 0;

        // Process rows starting from index 1 (skip headers)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row[phoneIdx]) continue;

            let phone = String(row[phoneIdx]).replace(/\D/g, '');
            if (phone.length < 10) continue;
            if (phone.length === 10) phone = '90' + phone;

            const name = nameIdx !== -1 ? String(row[nameIdx] || '') : null;

            // --- Additional Data Logic ---
            // Store all other columns in a JSON object
            const additionalData: Record<string, string> = {};
            headers.forEach((header, idx) => {
                // Don't duplicate name and phone in additional data
                if (idx !== phoneIdx && idx !== nameIdx && row[idx] !== undefined) {
                    const cleanHeader = header.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                    additionalData[cleanHeader] = String(row[idx]);
                }
            });

            try {
                await db.run(
                    'INSERT INTO customers (user_id, phone_number, name, additional_data) VALUES (?, ?, ?, ?) ' +
                    'ON CONFLICT(user_id, phone_number) DO UPDATE SET name=excluded.name, additional_data=excluded.additional_data',
                    [user.userId, phone, name, JSON.stringify(additionalData)]
                );
                count++;
            } catch (err) {
                console.error('Row insert error:', err);
            }
        }

        return NextResponse.json({ success: true, count, message: `${count} müşteri güncellendi/eklendi.` });
    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
