'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SPORT_COVER } from '@playpk/shared-types';
import type { MediaClip } from '@/lib/media-assets';
import { cn } from '@/lib/utils';

type Props = {
  clip: MediaClip;
  className?: string;
  minClassName?: string;
  /** Kept for callers; hero videos/shaders are disabled — poster image only. */
  autoPlay?: boolean;
  children: ReactNode;
};

/** Full-bleed hero with sharp landscape poster and broken-image fallback. */
export function HeroMedia({
  clip,
  className,
  minClassName = 'min-h-[42vw] min-h-[220px] sm:min-h-[280px]',
  children,
}: Props) {
  const [src, setSrc] = useState(clip.poster);

  useEffect(() => {
    setSrc(clip.poster);
  }, [clip.poster]);

  return (
    <div className={cn('relative w-full overflow-hidden', className)}>
      <div className={cn('relative w-full', minClassName)}>
        <Image
          src={src}
          alt=""
          fill
          priority
          quality={90}
          sizes="100vw"
          className="object-cover object-center"
          onError={() => {
            if (src !== DEFAULT_SPORT_COVER) setSrc(DEFAULT_SPORT_COVER);
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/55 to-navy/25" />
        <div className="relative z-10 flex h-full flex-col justify-end">{children}</div>
      </div>
    </div>
  );
}
