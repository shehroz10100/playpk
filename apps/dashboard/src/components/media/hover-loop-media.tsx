'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import type { MediaClip } from '@/lib/media-assets';
import { DISCOVER_HERO_IMAGE } from '@/lib/venue-cover';
import { cn } from '@/lib/utils';

type Props = {
  clip: MediaClip;
  alt?: string;
  sizes?: string;
  className?: string;
  /** Kept for callers; videos are disabled — image only. */
  ambient?: boolean;
  /** Kept for callers; hover no longer swaps to video. */
  hoverPlay?: boolean;
  children?: ReactNode;
};

/** Static image media for venue/sport cards (no video on hover). */
export function HoverLoopMedia({
  clip,
  alt = '',
  sizes = '280px',
  className,
  ambient = false,
  children,
}: Props) {
  const [src, setSrc] = useState(clip.poster);

  useEffect(() => {
    setSrc(clip.poster);
  }, [clip.poster]);

  return (
    <div className={cn('relative overflow-hidden bg-navy/10', className)}>
      <Image
        key={src}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        quality={85}
        className={cn('object-cover object-center', ambient ? 'opacity-90' : 'opacity-100')}
        onError={() => {
          if (src !== DISCOVER_HERO_IMAGE) setSrc(DISCOVER_HERO_IMAGE);
        }}
      />
      {children}
    </div>
  );
}
