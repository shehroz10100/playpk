'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { MOTION, useMotionSafe } from '@/lib/motion';
import { cn } from '@/lib/utils';

type RevealProps = {
  children: ReactNode;
  className?: string;
  index?: number;
};

/** Scroll / mount stagger reveal for cards and list rows. */
export function MotionReveal({ children, className, index = 0 }: RevealProps) {
  const { reduce, transition } = useMotionSafe();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: '0px 0px -32px 0px' }}
      transition={{
        ...transition(MOTION.base),
        delay: Math.min(index, 10) * MOTION.stagger,
      }}
    >
      {children}
    </motion.div>
  );
}

type PressProps = {
  children: ReactNode;
  className?: string;
} & Omit<HTMLMotionProps<'div'>, 'children'>;

/** Spring hover / tap shell for cards and CTA blocks. */
export function MotionPress({ children, className, ...rest }: PressProps) {
  const { reduce, spring } = useMotionSafe();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn('cursor-pointer', className)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={spring}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
