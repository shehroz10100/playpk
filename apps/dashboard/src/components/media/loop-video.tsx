'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type VideoHTMLAttributes,
} from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

type Props = {
  src: string;
  poster?: string;
  className?: string;
  style?: CSSProperties;
  /** Autoplay when intersecting viewport (default true). */
  autoPlayWhenVisible?: boolean;
  /** Force play (e.g. hover) even if not the primary hero slot. */
  play?: boolean;
  /** Opacity / visibility of the video element itself. */
  visible?: boolean;
  rootMargin?: string;
  threshold?: number;
} & Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src' | 'poster' | 'autoPlay' | 'controls'>;

/**
 * Muted looping clip. Plays only when in view (and not reduced-motion).
 * Never shows controls; always playsInline for iOS.
 */
export function LoopVideo({
  src,
  poster,
  className,
  style,
  autoPlayWhenVisible = true,
  play,
  visible = true,
  rootMargin = '120px',
  threshold = 0.2,
  ...rest
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, threshold]);

  const shouldLoad = inView || play === true || (autoPlayWhenVisible && !reduceMotion);
  const shouldPlay =
    !reduceMotion &&
    ready &&
    (play === true || (play !== false && autoPlayWhenVisible && inView));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (shouldPlay) {
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
    } else {
      el.pause();
    }
  }, [shouldPlay]);

  const onLoaded = useCallback(() => setReady(true), []);

  if (reduceMotion) {
    return null;
  }

  return (
    <video
      ref={ref}
      src={shouldLoad ? src : undefined}
      poster={poster}
      className={cn(
        'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
        visible && shouldPlay ? 'opacity-100' : 'opacity-0',
        className,
      )}
      style={style}
      muted
      playsInline
      loop
      preload={shouldLoad ? 'metadata' : 'none'}
      onLoadedData={onLoaded}
      aria-hidden
      {...rest}
    />
  );
}
