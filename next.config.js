const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const apiProxyTarget = process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_BASE_URL;

const nextConfig = {
    // output: 'standalone', // Disabled - causes issues with bcryptjs/jwt
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        unoptimized: true,
    },
    async rewrites() {
        if (!apiProxyTarget) return [];

        return [
            {
                source: '/api/:path*',
                destination: `${apiProxyTarget.replace(/\/$/, '')}/api/:path*`,
            },
        ];
    },
    webpack: (config) => {
        config.externals.push({
            'utf-8-validate': 'commonjs utf-8-validate',
            'bufferutil': 'commonjs bufferutil',
        });
        return config;
    },
    /* experimental: {
        serverComponentsExternalPackages: ['@whiskeysockets/baileys', 'pino'],
    }, */
};

module.exports = withPWA(nextConfig);
