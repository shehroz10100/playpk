/**
 * API base URL for dashboard fetch calls.
 *
 * - Local browser → http://localhost:4000 (or NEXT_PUBLIC_API_URL)
 * - Deployed browser (Vercel) → same-origin `/api/*`
 *   Next.js routes handle signup email OTP; other paths rewrite to Railway.
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

/** Never treat the Vercel app origin as a remote API base for env overrides. */
function isDashboardOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname.endsWith('.vercel.app') ||
      hostname === 'playpk.vercel.app' ||
      hostname === 'www.playpk.vercel.app'
    );
  } catch {
    return /vercel\.app/i.test(url);
  }
}

function firstPublicApiUrl(): string | null {
  const candidates = [process.env.API_URL, process.env.NEXT_PUBLIC_API_URL];
  for (const raw of candidates) {
    if (!raw) continue;
    const cleaned = raw.replace(/\/$/, '');
    if (isLoopback(cleaned)) continue;
    if (isDashboardOrigin(cleaned)) continue;
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
      if (!isLoopback(local) && !isDashboardOrigin(local)) return local;
      return 'http://localhost:4000';
    }
    // Production browser: same-origin so Vercel can serve email-OTP signup routes
    // and rewrite other /api/* calls to Railway.
    return '';
  }

  const publicUrl = firstPublicApiUrl();
  if (publicUrl) return publicUrl;

  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return RAILWAY_API;
  }

  return 'http://localhost:4000';
}
