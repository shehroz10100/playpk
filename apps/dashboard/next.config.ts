/** @type {import('next').NextConfig} */

const RAILWAY_API = 'https://api-production-2057.up.railway.app';

function isLoopback(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return /localhost|127\.0\.0\.1/.test(url);
  }
}

/**
 * On Vercel, never proxy to localhost — phones (and Vercel’s edge) cannot reach
 * the developer’s machine. Prefer API_URL, then a public NEXT_PUBLIC_API_URL,
 * then the live Railway API.
 */
function resolveApiOrigin(): string {
  const candidates = [process.env.API_URL, process.env.NEXT_PUBLIC_API_URL];
  for (const raw of candidates) {
    if (!raw) continue;
    const cleaned = raw.replace(/\/$/, '');
    // Never bake localhost into a Vercel/production build.
    if (isLoopback(cleaned)) continue;
    return cleaned;
  }
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return RAILWAY_API;
  }
  return 'http://localhost:4000';
}

const API_ORIGIN = resolveApiOrigin();

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
