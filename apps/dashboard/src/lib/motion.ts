'use client';

import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

/** UI feedback timing from design-system/MASTER.md (150–300ms). */
export const MOTION = {
  fast: 0.15,
  base: 0.22,
  slow: 0.3,
  stagger: 0.05,
} as const;

export function useMotionSafe() {
  const reduce = usePrefersReducedMotion();
  return {
    reduce,
    duration: (seconds: number) => (reduce ? 0 : seconds),
    transition: (seconds: number = MOTION.base) =>
      reduce ? { duration: 0 } : { duration: seconds, ease: [0.22, 1, 0.36, 1] as const },
    spring: reduce
      ? { duration: 0 }
      : { type: 'spring' as const, stiffness: 420, damping: 28, mass: 0.7 },
  };
}
