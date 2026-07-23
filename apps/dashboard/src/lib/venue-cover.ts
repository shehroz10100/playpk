import { resolveSportCover } from '@playpk/shared-types';

const CITY_COVER = resolveSportCover('All');

/** Skip fragile upload paths (often missing on disk / Railway). */
function isUnusableUploadUrl(src: string): boolean {
  try {
    const u = new URL(src, 'http://localhost');
    if (u.pathname.startsWith('/uploads/')) return true;
    const host = u.hostname;
    if ((host === 'localhost' || host === '127.0.0.1') && u.pathname.startsWith('/uploads/')) {
      return true;
    }
    return false;
  } catch {
    return src.includes('/uploads/');
  }
}

export function mediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
  if (src.startsWith('/')) return src;
  return `/uploads/${src.replace(/^\//, '')}`;
}

/**
 * Best cover for a venue list/detail card.
 * Prefer curated sport covers (reliable Unsplash) over broken venue photo paths.
 */
export function resolveVenueCover(venue: {
  name: string;
  photos?: string[] | null;
  sports?: Array<{ name: string; iconUrl?: string | null }> | null;
}): string {
  const sport = venue.sports?.[0]?.name;
  if (sport) return resolveSportCover(sport, venue.sports?.[0]?.iconUrl);

  const photo = venue.photos
    ?.map(mediaUrl)
    .find(
      (p): p is string =>
        typeof p === 'string' && !isUnusableUploadUrl(p) && /^https?:\/\//i.test(p),
    );
  if (photo) return photo;

  return CITY_COVER;
}

export const LOGIN_HERO_IMAGE = resolveSportCover('Tennis');

export const DISCOVER_HERO_IMAGE = resolveSportCover('Futsal');
