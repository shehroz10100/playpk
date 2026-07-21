'use client';

import { useEffect, useRef, useState } from 'react';
import { useMotionSafe } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Props = {
  value: number;
  className?: string;
  durationMs?: number;
  decimals?: number;
};

/** Count-up for stats; instant when reduced-motion. */
export function CountUp({ value, className, durationMs = 700, decimals = 0 }: Props) {
  const { reduce } = useMotionSafe();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const pref = useRef(value);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const from = pref.current;
    pref.current = value;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs, reduce]);

  const formatted =
    decimals > 0 ? display.toFixed(decimals) : String(Math.round(display));

  return <span className={cn('tabular-nums', className)}>{formatted}</span>;
}
