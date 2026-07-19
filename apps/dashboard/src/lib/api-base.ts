/**
 * Browser uses same-origin (`''`) so fetch goes to `/api/...` on the Vercel host.
 * Next.js rewrites proxy those to the real API (see next.config.ts).
 * That way phones never call localhost — only the Vercel origin.
 *
 * Server-side code still calls the backend directly via API_URL / NEXT_PUBLIC_API_URL.
 */
export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    return '';
  }

  return (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:4000'
  ).replace(/\/$/, '');
}
