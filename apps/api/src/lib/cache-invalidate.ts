import { cacheDel } from './cache';

const VENUES_LIST_PREFIX = 'venues:list:';
const SPORTS_CACHE_KEY = 'sports:list';

/** Drop all cached venue list responses (price, city, approval, photos, ratings). */
export async function invalidateVenueListCache(): Promise<void> {
  await cacheDel(`${VENUES_LIST_PREFIX}*`);
}

/** Drop cached sports rail (rarely changes). */
export async function invalidateSportsCache(): Promise<void> {
  await cacheDel(SPORTS_CACHE_KEY);
}

/** Venue discovery data that affects list cards. */
export async function invalidateVenueDiscoveryCache(): Promise<void> {
  await Promise.all([invalidateVenueListCache(), invalidateSportsCache()]);
}
