import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

type Options = {
  intervalMs: number;
  immediate?: boolean;
};

/** Poll only while the app is in the foreground. */
export function useAppStatePoll(
  callback: () => void | Promise<void>,
  enabled: boolean,
  { intervalMs, immediate = true }: Options,
) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const run = () => void saved.current();
    if (immediate) void run();

    let id: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (id !== undefined) return;
      id = setInterval(run, intervalMs);
    };

    const stop = () => {
      if (id === undefined) return;
      clearInterval(id);
      id = undefined;
    };

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void run();
        start();
      } else {
        stop();
      }
    };

    if (AppState.currentState === 'active') start();

    const sub = AppState.addEventListener('change', onChange);
    return () => {
      stop();
      sub.remove();
    };
  }, [enabled, intervalMs, immediate]);
}
