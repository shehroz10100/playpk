'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useMotionSafe } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Props = {
  active?: boolean;
  className?: string;
  children: ReactNode;
};

/** Subtle glow / scale pulse when the user's rank row is highlighted. */
export function RankUpGlow({ active = false, className, children }: Props) {
  const { reduce } = useMotionSafe();

  if (!active) {
    return <div className={className}>{children}</div>;
  }

  if (reduce) {
    return (
      <div className={cn('rounded-xl bg-[#F59E0B]/15 ring-1 ring-[#F59E0B]/40', className)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={cn('rounded-xl bg-[#F59E0B]/15 ring-1 ring-[#F59E0B]/45', className)}
      initial={{ scale: 1, boxShadow: '0 0 0 rgba(245,158,11,0)' }}
      animate={{
        scale: [1, 1.015, 1],
        boxShadow: [
          '0 0 0 rgba(245,158,11,0)',
          '0 0 24px rgba(245,158,11,0.35)',
          '0 0 10px rgba(245,158,11,0.16)',
        ],
      }}
      transition={{ duration: 0.55, ease: 'easeOut', times: [0, 0.45, 1] }}
    >
      {children}
    </motion.div>
  );
}
