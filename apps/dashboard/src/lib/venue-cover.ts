import { resolveSportCover } from '@playpk/shared-types';

const CITY_COVER = resolveSportCover('All');

/** Seed/demo DBs often store localhost upload paths that 404 (file never on disk). */
function isUnusableUploadUrl(src: string): boolean {
  try {
    const u = new URL(src, 'http://localhost');
    const host = u.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') return false;
    return u.pathname.startsWith('/uploads/');
  } catch {
    return false;
  }
}

export function mediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
  if (src.startsWith('/')) return src;
  return `/uploads/${src.replace(/^\//, '')}`;
}

/** Best cover for a venue list/detail card — usable photo → primary sport → city. */
export function resolveVenueCover(venue: {
  name: string;
  photos?: string[] | null;
  sports?: Array<{ name: string; iconUrl?: string | null }> | null;
}): string {
  const photo = venue.photos
    ?.map(mediaUrl)
    .find((p): p is string => typeof p === 'string' && !isUnusableUploadUrl(p));
  if (photo) return photo;

  const sport = venue.sports?.[0]?.name;
  if (sport) return resolveSportCover(sport, venue.sports?.[0]?.iconUrl);

  return CITY_COVER;
}

export const LOGIN_HERO_IMAGE = resolveSportCover('Tennis');

export const DISCOVER_HERO_IMAGE = resolveSportCover('Futsal');
