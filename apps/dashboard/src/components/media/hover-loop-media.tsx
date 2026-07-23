'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SPORT_COVER } from '@playpk/shared-types';
import type { MediaClip } from '@/lib/media-assets';
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
  priority?: boolean;
};

/** Static image media for venue/sport cards with broken-image fallback. */
export function HoverLoopMedia({
  clip,
  alt = '',
  sizes = '280px',
  className,
  ambient = false,
  children,
  priority = false,
}: Props) {
  const [src, setSrc] = useState(clip.poster);

  useEffect(() => {
    setSrc(clip.poster);
  }, [clip.poster]);

  return (
    <div className={cn('relative overflow-hidden bg-navy/15', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={85}
        className={cn('object-cover object-center', ambient ? 'opacity-90' : 'opacity-100')}
        onError={() => {
          if (src !== DEFAULT_SPORT_COVER) setSrc(DEFAULT_SPORT_COVER);
        }}
      />
      {children}
    </div>
  );
}
