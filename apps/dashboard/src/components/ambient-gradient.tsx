'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { AMBIENT, AMBIENT_POSTER_SRC } from '@/lib/ambient-tokens';
import { cn } from '@/lib/utils';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: true });
    return Boolean(gl);
  } catch {
    return false;
  }
}

function isLowEndDevice(): boolean {
  try {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    if (nav.connection?.saveData) return true;
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 && nav.deviceMemory <= 2) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

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

function AmbientPoster({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <Image
        src={AMBIENT_POSTER_SRC}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
        unoptimized
      />
    </div>
  );
}

const ShaderLayer = dynamic(
  () =>
    import('@shadergradient/react').then((mod) => {
      function Layer({ pixelDensity }: { pixelDensity: number }) {
        const { ShaderGradient, ShaderGradientCanvas } = mod;
        return (
          <ShaderGradientCanvas
            style={{ position: 'absolute', inset: 0 }}
            className="pointer-events-none"
            pixelDensity={pixelDensity}
            fov={45}
            pointerEvents="none"
            lazyLoad
            threshold={0.1}
            rootMargin="200px"
            powerPreference="low-power"
          >
            <ShaderGradient
              type="waterPlane"
              animate="on"
              uSpeed={AMBIENT.uSpeed}
              uStrength={AMBIENT.uStrength}
              uDensity={1.1}
              uFrequency={4.2}
              color1={AMBIENT.color1}
              color2={AMBIENT.color2}
              color3={AMBIENT.color3}
              cDistance={AMBIENT.cDistance}
              cPolarAngle={AMBIENT.cPolarAngle}
              grain="off"
              lightType="3d"
              brightness={1.05}
              reflection={0.08}
            />
          </ShaderGradientCanvas>
        );
      }
      return Layer;
    }),
  { ssr: false },
);

type AmbientGradientProps = {
  className?: string;
  style?: CSSProperties;
  /** `subtle` = atmosphere under hero; `banner` = promo strips */
  intensity?: 'subtle' | 'banner';
  /** Cap DPR for mobile GPUs (MASTER: 1–1.5) */
  pixelDensity?: number;
};

/**
 * Atmosphere WebGL layer for heroes / promos / empty states only.
 * Poster paints first; canvas hydrates after idle when WebGL + motion allow.
 */
export function AmbientGradient({
  className,
  style,
  intensity = 'subtle',
  pixelDensity = AMBIENT.pixelDensity,
}: AmbientGradientProps) {
  const reduceMotion = usePrefersReducedMotion();
  const [canAnimate, setCanAnimate] = useState(false);
  const [hydrate, setHydrate] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      setCanAnimate(false);
      return;
    }
    const ok = detectWebGL() && !isLowEndDevice();
    setCanAnimate(ok);
  }, [reduceMotion]);

  useEffect(() => {
    if (!canAnimate) return;
    let cancelled = false;
    const start = () => {
      if (!cancelled) setHydrate(true);
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(start, { timeout: 1200 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }

    const t = window.setTimeout(start, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [canAnimate]);

  const density = Math.min(1.5, Math.max(1, pixelDensity));

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        intensity === 'subtle' && 'opacity-90',
        intensity === 'banner' && 'opacity-100',
        className,
      )}
      style={style}
    >
      <AmbientPoster />
      {hydrate && canAnimate ? (
        <div className="absolute inset-0 opacity-[0.92]">
          <ShaderLayer pixelDensity={density} />
        </div>
      ) : null}
    </div>
  );
}

/** Promo / CTA strip with ambient atmosphere behind content. */
export function AmbientPromo({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl text-white shadow-panel', className)}>
      <AmbientGradient intensity="banner" className="rounded-2xl" />
      <div className="absolute inset-0 bg-navy/55" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** Loading / empty atmosphere — CSS-only (no WebGL on dense/list contexts). */
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
