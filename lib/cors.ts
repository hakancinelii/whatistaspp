import { NextRequest, NextResponse } from 'next/server';

const defaultMethods = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const defaultHeaders = 'Content-Type, Authorization';

function getAllowedOrigins() {
    return (process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}

export function corsHeaders(request: NextRequest) {
    const origin = request.headers.get('origin');
    const allowedOrigins = getAllowedOrigins();
    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': defaultMethods,
        'Access-Control-Allow-Headers': defaultHeaders,
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    };

    if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    return headers;
}

export function corsPreflight(request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(request),
    });
}

export function withCors(request: NextRequest, response: NextResponse) {
    Object.entries(corsHeaders(request)).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    return response;
}

export function corsJson(request: NextRequest, body: unknown, init?: ResponseInit) {
    return withCors(request, NextResponse.json(body, init));
}

export function publicUrl(path: string) {
    const baseUrl = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
