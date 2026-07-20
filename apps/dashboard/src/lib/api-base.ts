/**
 * API base URL for dashboard fetch calls.
 *
 * - Local browser → http://localhost:4000 (or NEXT_PUBLIC_API_URL)
 * - Deployed browser (Vercel) → Railway HTTPS API directly
 *   (CORS is open on the API; avoids broken Vercel /api rewrites)
 * - Server-side on Vercel → Railway (never localhost)
 */

const RAILWAY_API = 'https://api-production-2057.up.railway.app';

function isLoopback(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return /localhost|127\.0\.0\.1/.test(url);
  }
}

function firstPublicApiUrl(): string | null {
  const candidates = [process.env.API_URL, process.env.NEXT_PUBLIC_API_URL];
  for (const raw of candidates) {
    if (!raw) continue;
    const cleaned = raw.replace(/\/$/, '');
    if (isLoopback(cleaned)) continue;
    if (cleaned.startsWith('https://') || cleaned.startsWith('http://')) return cleaned;
  }
  return null;
}

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      const local =
        process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';
      return local;
    }
    return firstPublicApiUrl() ?? RAILWAY_API;
  }

  const publicUrl = firstPublicApiUrl();
  if (publicUrl) return publicUrl;

  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return RAILWAY_API;
  }

  return 'http://localhost:4000';
}
