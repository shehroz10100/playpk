import { resolveSportCover, DEFAULT_SPORT_COVER } from '@playpk/shared-types';

const CITY_COVER = resolveSportCover('All');

/** Seed/demo uploads and API /uploads paths often 404 on Vercel/Railway. */
export function isUnusableMediaUrl(src: string): boolean {
  if (!src.trim()) return true;
  if (src.includes('/uploads/')) return true;
  try {
    const u = new URL(src, 'http://localhost');
    const host = u.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
  } catch {
    return true;
  }
  return false;
}

export function mediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
  if (src.startsWith('/')) return src;
  return `/uploads/${src.replace(/^\//, '')}`;
}

/**
 * Best cover for a venue list/detail card.
 * Prefer curated sport photos so venues always show a clear sports image on mobile.
 */
export function resolveVenueCover(venue: {
  name: string;
  photos?: string[] | null;
  sports?: Array<{ name: string; iconUrl?: string | null }> | null;
  courts?: Array<{ sport?: { name: string; iconUrl?: string | null } | null }> | null;
}): string {
  const sportName =
    venue.sports?.[0]?.name ??
    venue.courts?.find((c) => c.sport?.name)?.sport?.name ??
    null;

  if (sportName) {
    return resolveSportCover(sportName);
  }

  const photo = venue.photos
    ?.map(mediaUrl)
    .find((p): p is string => typeof p === 'string' && !isUnusableMediaUrl(p));
  if (photo) return photo;

  return CITY_COVER || DEFAULT_SPORT_COVER;
}

export const LOGIN_HERO_IMAGE = resolveSportCover('Tennis');

export const DISCOVER_HERO_IMAGE = resolveSportCover('Futsal');
