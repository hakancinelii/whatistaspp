/** @type {import('next').NextConfig} */
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

module.exports = nextConfig;
