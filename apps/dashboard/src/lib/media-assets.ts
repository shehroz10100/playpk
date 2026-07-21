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

const SPORT_CLIPS: Record<string, MediaClip> = {
  Futsal: {
    src: '/media/sport-futsal.mp4',
    poster:
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&h=1000&q=70',
  },
  Football: {
    src: '/media/sport-futsal.mp4',
    poster:
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&h=1000&q=70',
  },
  Tennis: {
    src: '/media/sport-tennis.mp4',
    poster:
      'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=800&h=1000&q=70',
  },
  Padel: {
    src: '/media/sport-padel.mp4',
    poster:
      'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&h=1000&q=70',
  },
  Cricket: {
    src: '/media/sport-cricket.mp4',
    poster:
      'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=800&h=1000&q=70',
  },
  Badminton: {
    src: '/media/sport-tennis.mp4',
    poster:
      'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&h=1000&q=70',
  },
};

export function resolveSportClip(sportName: string, posterFallback?: string): MediaClip {
  const key = Object.keys(SPORT_CLIPS).find((k) => k.toLowerCase() === sportName.trim().toLowerCase());
  if (key) {
    const clip = SPORT_CLIPS[key];
    return posterFallback ? { ...clip, poster: posterFallback } : clip;
  }
  return {
    src: VENUE_PREVIEW_CLIP.src,
    poster: posterFallback ?? VENUE_PREVIEW_CLIP.poster,
  };
}

export function resolveVenuePreviewClip(poster: string): MediaClip {
  return { src: VENUE_PREVIEW_CLIP.src, poster };
}
