'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
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
  return (
    <div className={cn('relative overflow-hidden bg-navy/10', className)}>
      <Image
        src={clip.poster}
        alt={alt}
        fill
        sizes={sizes}
        className={cn('object-cover', ambient ? 'opacity-90' : 'opacity-100')}
      />
      {children}
    </div>
  );
}
