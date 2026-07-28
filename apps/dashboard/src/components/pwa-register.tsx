'use client';

import { useEffect } from 'react';

/** Registers the offline shell service worker (production only). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* install still works without SW */
    });
  }, []);

  return null;
}
