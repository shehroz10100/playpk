'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
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

/** Hero stack: static poster image → light scrim → content (no video / no shader blotch). */
export function HeroMedia({
  clip,
  className,
  minClassName = 'min-h-[200px] sm:min-h-[240px]',
  children,
}: Props) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div className={cn('relative', minClassName)}>
        <Image
          src={clip.poster}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/45 to-navy/25" />
        <div className="relative z-10 flex h-full flex-col justify-end">{children}</div>
      </div>
    </div>
  );
}
