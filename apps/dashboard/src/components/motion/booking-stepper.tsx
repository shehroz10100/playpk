'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { MOTION, useMotionSafe } from '@/lib/motion';
import { cn } from '@/lib/utils';

const STEPS = ['Date', 'Slot', 'Confirm', 'Pay'] as const;

type Props = {
  /** 0-based step index */
  step: number;
  className?: string;
  /** Checkout stays calm — shorter fades only */
  calm?: boolean;
};

export function BookingStepper({ step, className, calm = true }: Props) {
  const { reduce, transition } = useMotionSafe();
  const active = Math.min(Math.max(step, 0), STEPS.length - 1);

  return (
    <div className={cn('space-y-3', className)}>
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {STEPS.map((label, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center gap-1.5">
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-200',
                    done && 'bg-brand text-white',
                    current && 'bg-[#F59E0B] text-navy',
                    !done && !current && 'bg-navy/10 text-navy/50',
                  )}
                >
                  {i + 1}
                </span>
                {i < STEPS.length - 1 ? (
                  <span
                    className={cn(
                      'h-0.5 flex-1 rounded-full transition-colors duration-200',
                      i < active ? 'bg-brand' : 'bg-navy/10',
                    )}
                  />
                ) : null}
              </div>
              <span
                className={cn(
                  'truncate text-[10px] font-semibold sm:text-[11px]',
                  current ? 'text-navy' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {!reduce && !calm ? (
        <AnimatePresence mode="wait">
          <motion.p
            key={active}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={transition(MOTION.fast)}
            className="text-center text-xs text-muted-foreground"
          >
            Step {active + 1}: {STEPS[active]}
          </motion.p>
        </AnimatePresence>
      ) : null}
    </div>
  );
}

type PanelProps = {
  stepKey: string | number;
  children: ReactNode;
  className?: string;
};

/** Calm cross-fade between booking panels (no spring bounce on pay). */
export function BookingStepPanel({ stepKey, children, className }: PanelProps) {
  const { reduce, transition } = useMotionSafe();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        className={className}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={transition(MOTION.base)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
