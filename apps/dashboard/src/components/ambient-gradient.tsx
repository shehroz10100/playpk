'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Static stadium wash — use behind dense UI or when WebGL/motion is off. */
export function AmbientFlat({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      className={cn('bg-ambient-flat pointer-events-none absolute inset-0', className)}
      style={style}
    />
  );
}

type AmbientGradientProps = {
  className?: string;
  style?: CSSProperties;
  /** `subtle` = atmosphere under hero; `banner` = promo strips */
  intensity?: 'subtle' | 'banner';
  /** Kept for callers; shader density no longer used. */
  pixelDensity?: number;
};

/**
 * Atmosphere layer for heroes / promos — CSS wash only.
 * WebGL shader/poster diamond removed (caused dark blotch over images).
 */
export function AmbientGradient({
  className,
  style,
  intensity = 'subtle',
}: AmbientGradientProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        intensity === 'subtle' && 'opacity-70',
        intensity === 'banner' && 'opacity-100',
        className,
      )}
      style={style}
    >
      <AmbientFlat />
    </div>
  );
}

/** Promo / CTA strip — flat stadium wash only (no WebGL / poster diamond blotch). */
export function AmbientPromo({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl text-white shadow-panel', className)}>
      <AmbientFlat />
      <div className="absolute inset-0 bg-gradient-to-r from-navy/50 via-navy/35 to-navy/20" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** Loading / empty atmosphere — CSS-only. */
export function AmbientSkeleton({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/10 bg-navy/5',
        className,
      )}
    >
      <AmbientFlat className="opacity-40" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
