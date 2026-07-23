'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import type { MediaClip } from '@/lib/media-assets';
import { DISCOVER_HERO_IMAGE } from '@/lib/venue-cover';
import { cn } from '@/lib/utils';

type Props = {
  clip: MediaClip;
  className?: string;
  minClassName?: string;
  /** Kept for callers; hero videos/shaders are disabled — poster image only. */
  autoPlay?: boolean;
  children: ReactNode;
};

/** Hero stack: sharp landscape poster → light scrim → content. */
export function HeroMedia({
  clip,
  className,
  minClassName = 'min-h-[200px] sm:min-h-[260px]',
  children,
}: Props) {
  const [src, setSrc] = useState(clip.poster);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div className={cn('relative', minClassName)}>
        <Image
          src={src}
          alt=""
          fill
          priority
          quality={85}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 900px, 1200px"
          className="object-cover object-center"
          onError={() => {
            if (src !== DISCOVER_HERO_IMAGE) setSrc(DISCOVER_HERO_IMAGE);
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/35 to-navy/15" />
        <div className="relative z-10 flex h-full flex-col justify-end">{children}</div>
      </div>
    </div>
  );
}
