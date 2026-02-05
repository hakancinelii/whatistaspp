import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const cwd = process.cwd(); // Should be /app
        const dataDir = path.join(cwd, 'data');

        // Check BOTH database locations
        const rootDbPath = path.join(cwd, 'database.db');
        const dataDbPath = path.join(dataDir, 'database.db');

        const rootDbExists = fs.existsSync(rootDbPath);
        const dataDbExists = fs.existsSync(dataDbPath);

        let rootDbSize = 0;
        let dataDbSize = 0;

        if (rootDbExists) {
            rootDbSize = fs.statSync(rootDbPath).size;
        }
        if (dataDbExists) {
            dataDbSize = fs.statSync(dataDbPath).size;
        }

        // List files in data directory
        const dataDirExists = fs.existsSync(dataDir);
        let dataFiles: string[] = [];
        if (dataDirExists) {
            dataFiles = fs.readdirSync(dataDir);
        }

        // List files in root directory (looking for database files)
        const rootFiles = fs.readdirSync(cwd).filter(f => f.endsWith('.db'));

        return NextResponse.json({
            cwd,
            databases: {
                root: {
                    path: rootDbPath,
                    exists: rootDbExists,
                    size: rootDbSize
                },
                data: {
                    path: dataDbPath,
                    exists: dataDbExists,
                    size: dataDbSize
                }
            },
            rootDbFiles: rootFiles,
            dataFiles: dataFiles,
            message: rootDbExists && dataDbExists
                ? '⚠️ İKİ DATABASE VAR! Bu sorunun kaynağı!'
                : 'Tek database var.'
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
