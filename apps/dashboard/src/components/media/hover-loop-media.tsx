'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import { LoopVideo } from '@/components/media/loop-video';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import type { MediaClip } from '@/lib/media-assets';
import { cn } from '@/lib/utils';

type Props = {
  clip: MediaClip;
  alt?: string;
  sizes?: string;
  className?: string;
  /** Low-opacity always-on loop (sport tiles). */
  ambient?: boolean;
  /** Cross-fade to video on hover/focus (venue cards). */
  hoverPlay?: boolean;
  children?: ReactNode;
};

export function HoverLoopMedia({
  clip,
  alt = '',
  sizes = '280px',
  className,
  ambient = false,
  hoverPlay = true,
  children,
}: Props) {
  const reduceMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(false);
  const showVideo = !reduceMotion && (ambient || (hoverPlay && active));

  return (
    <div
      className={cn('relative overflow-hidden bg-navy/10', className)}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      <Image
        src={clip.poster}
        alt={alt}
        fill
        sizes={sizes}
        className={cn(
          'object-cover transition duration-500',
          showVideo && hoverPlay && !ambient ? 'opacity-0 scale-105' : 'opacity-100',
          ambient ? 'opacity-90' : null,
        )}
      />
      {!reduceMotion ? (
        <LoopVideo
          src={clip.src}
          poster={clip.poster}
          play={showVideo}
          autoPlayWhenVisible={ambient}
          visible={showVideo}
          className={cn(ambient && 'opacity-35')}
        />
      ) : null}
      {children}
    </div>
  );
}
