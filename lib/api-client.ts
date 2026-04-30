export function apiUrl(path: string) {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

type ApiFetchOptions = RequestInit & {
    auth?: boolean;
};

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
    const { auth = true, headers, ...rest } = options;
    const requestHeaders = new Headers(headers);

    if (auth && typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token && !requestHeaders.has('Authorization')) {
            requestHeaders.set('Authorization', `Bearer ${token}`);
        }
    }

    return fetch(apiUrl(path), {
        ...rest,
        headers: requestHeaders,
    });
}
