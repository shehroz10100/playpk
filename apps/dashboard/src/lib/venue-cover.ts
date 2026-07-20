import { resolveSportCover } from '@playpk/shared-types';

/** Named venue fallbacks when courts have no uploaded photos yet. */
const VENUE_COVER_FALLBACKS: Record<string, string> = {
  '360 Arena':
    'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&h=800&q=80',
  'GameOn DHA Phase 5':
    'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&h=800&q=80',
};

const CITY_COVER =
  'https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=1600&h=900&q=80';

export function mediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
  if (src.startsWith('/')) return src;
  return `/uploads/${src.replace(/^\//, '')}`;
}

/** Best cover for a venue list/detail card — photo → named fallback → sport → city. */
export function resolveVenueCover(venue: {
  name: string;
  photos?: string[] | null;
  sports?: Array<{ name: string; iconUrl?: string | null }> | null;
}): string {
  const photo = venue.photos?.map(mediaUrl).find(Boolean);
  if (photo) return photo;

  const named = VENUE_COVER_FALLBACKS[venue.name];
  if (named) return named;

  const sport = venue.sports?.[0]?.name;
  if (sport) return resolveSportCover(sport, venue.sports?.[0]?.iconUrl);

  return CITY_COVER;
}

export const LOGIN_HERO_IMAGE =
  'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1600&h=2000&q=80';

export const DISCOVER_HERO_IMAGE =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&h=900&q=80';
