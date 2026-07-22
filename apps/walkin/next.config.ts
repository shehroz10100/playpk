/** @type {import('next').NextConfig} */

const nextConfig = {
  transpilePackages: ['@playpk/shared-types'],
  async rewrites() {
    const apiOrigin =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';
    return [
      { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
      { source: '/health', destination: `${apiOrigin}/health` },
      { source: '/uploads/:path*', destination: `${apiOrigin}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
