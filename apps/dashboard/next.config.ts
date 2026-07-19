/** @type {import('next').NextConfig} */
const API_ORIGIN = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.VERCEL
    ? 'https://api-production-2057.up.railway.app'
    : 'http://localhost:4000')
).replace(/\/$/, '');

const nextConfig = {
  transpilePackages: ['@playpk/shared-types'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${API_ORIGIN}/health`,
      },
      {
        source: '/uploads/:path*',
        destination: `${API_ORIGIN}/uploads/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: '*.up.railway.app',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
