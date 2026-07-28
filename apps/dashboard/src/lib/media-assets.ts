import { resolveSportCover } from '@playpk/shared-types';
import { DISCOVER_HERO_IMAGE, LOGIN_HERO_IMAGE } from '@/lib/venue-cover';

export type MediaClip = {
  /** Legacy video path — unused; posters drive UI. */
  src: string;
  poster: string;
};

/** Image posters for hero / venue / sport surfaces (videos removed for performance). */
export const HERO_CLIP: MediaClip = {
  src: '',
  poster: DISCOVER_HERO_IMAGE,
};

export const LOGIN_HERO_CLIP: MediaClip = {
  src: '',
  poster: LOGIN_HERO_IMAGE,
};

export const VENUE_PREVIEW_CLIP: MediaClip = {
  src: '',
  poster: DISCOVER_HERO_IMAGE,
};

export function resolveSportClip(sportName: string, posterFallback?: string): MediaClip {
  const poster = posterFallback ?? resolveSportCover(sportName, null, 'rail');
  return { src: '', poster };
}

export function resolveVenuePreviewClip(poster: string): MediaClip {
  return { src: '', poster };
}
