import { resolveSportCover } from '@playpk/shared-types';
import { DISCOVER_HERO_IMAGE, LOGIN_HERO_IMAGE } from '@/lib/venue-cover';

export type MediaClip = {
  src: string;
  poster: string;
};

/** Local loops under public/media (≤2MB, ~360p). Replace with venue-owned clips later. */
export const HERO_CLIP: MediaClip = {
  src: '/media/hero-court.mp4',
  poster: DISCOVER_HERO_IMAGE,
};

export const LOGIN_HERO_CLIP: MediaClip = {
  src: '/media/hero-court.mp4',
  poster: LOGIN_HERO_IMAGE,
};

export const VENUE_PREVIEW_CLIP: MediaClip = {
  src: '/media/venue-preview.mp4',
  poster: DISCOVER_HERO_IMAGE,
};

const SPORT_CLIP_SRC: Record<string, string> = {
  Futsal: '/media/sport-futsal.mp4',
  Football: '/media/sport-futsal.mp4',
  Tennis: '/media/sport-tennis.mp4',
  Padel: '/media/sport-padel.mp4',
  Cricket: '/media/sport-cricket.mp4',
  // No dedicated badminton loop yet — tennis motion is closer than padel/futsal.
  Badminton: '/media/sport-tennis.mp4',
};

export function resolveSportClip(sportName: string, posterFallback?: string): MediaClip {
  const key = Object.keys(SPORT_CLIP_SRC).find(
    (k) => k.toLowerCase() === sportName.trim().toLowerCase(),
  );
  const poster = posterFallback ?? resolveSportCover(sportName);
  if (key) {
    return { src: SPORT_CLIP_SRC[key], poster };
  }
  return {
    src: VENUE_PREVIEW_CLIP.src,
    poster,
  };
}

export function resolveVenuePreviewClip(poster: string): MediaClip {
  return { src: VENUE_PREVIEW_CLIP.src, poster };
}
