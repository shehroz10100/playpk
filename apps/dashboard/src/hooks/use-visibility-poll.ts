'use client';

import { useEffect, useRef } from 'react';

type Options = {
  /** Poll interval when tab is visible. */
  intervalMs: number;
  /** Run immediately on mount / when enabled. Default true. */
  immediate?: boolean;
  /** Run when window regains focus. Default true. */
  onFocus?: boolean;
};

/**
 * Runs a callback on an interval only while the browser tab is visible.
 * Pauses when hidden to cut idle API load.
 */
export function useVisibilityPoll(
  callback: () => void | Promise<void>,
  enabled: boolean,
  { intervalMs, immediate = true, onFocus = true }: Options,
) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const run = () => void saved.current();

    if (immediate) void run();

    let id: number | undefined;

    const start = () => {
      if (id !== undefined) return;
      id = window.setInterval(run, intervalMs);
    };

    const stop = () => {
      if (id === undefined) return;
      window.clearInterval(id);
      id = undefined;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void run();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') {
      start();
    }

    document.addEventListener('visibilitychange', onVisibility);

    const onWindowFocus = () => {
      if (document.visibilityState === 'visible') void run();
    };
    if (onFocus) {
      window.addEventListener('focus', onWindowFocus);
    }

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      if (onFocus) window.removeEventListener('focus', onWindowFocus);
    };
  }, [enabled, intervalMs, immediate, onFocus]);
}
