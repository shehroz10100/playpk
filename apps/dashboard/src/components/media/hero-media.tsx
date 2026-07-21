'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { AmbientGradient } from '@/components/ambient-gradient';
import { LoopVideo } from '@/components/media/loop-video';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import type { MediaClip } from '@/lib/media-assets';
import { cn } from '@/lib/utils';

type Props = {
  clip: MediaClip;
  className?: string;
  minClassName?: string;
  /** Only one hero should autoplay above the fold per page. */
  autoPlay?: boolean;
  children: ReactNode;
};

/** Hero stack: ambient → poster → optional loop → navy/turf scrim → content. */
export function HeroMedia({
  clip,
  className,
  minClassName = 'min-h-[200px] sm:min-h-[240px]',
  autoPlay = true,
  children,
}: Props) {
  const reduceMotion = usePrefersReducedMotion();

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
          className="object-cover opacity-50 mix-blend-luminosity"
        />
        {!reduceMotion && autoPlay ? (
          <LoopVideo
            src={clip.src}
            poster={clip.poster}
            autoPlayWhenVisible
            className="opacity-60 mix-blend-luminosity"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/70 to-navy/30" />
        <div className="relative z-10 flex h-full flex-col justify-end">{children}</div>
      </div>
    </div>
  );
}
