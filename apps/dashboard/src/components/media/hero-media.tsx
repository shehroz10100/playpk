'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { AmbientGradient } from '@/components/ambient-gradient';
import type { MediaClip } from '@/lib/media-assets';
import { cn } from '@/lib/utils';

type Props = {
  clip: MediaClip;
  className?: string;
  minClassName?: string;
  /** Kept for callers; hero videos are disabled — poster image only. */
  autoPlay?: boolean;
  children: ReactNode;
};

/** Hero stack: ambient → poster image → navy/turf scrim → content (no video). */
export function HeroMedia({
  clip,
  className,
  minClassName = 'min-h-[200px] sm:min-h-[240px]',
  children,
}: Props) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div className={cn('relative', minClassName)}>
        <AmbientGradient intensity="subtle" />
        <Image
          src={clip.poster}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/70 to-navy/30" />
        <div className="relative z-10 flex h-full flex-col justify-end">{children}</div>
      </div>
    </div>
  );
}
