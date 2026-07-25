'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { AuthTokensResponse } from '@playpk/shared-types';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || '';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: Record<string, unknown>) => void;
          prompt: (cb?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
          }) => void) => void;
          renderButton: (el: HTMLElement, cfg: Record<string, unknown>) => void;
        };
      };
    };
  }
}

type Props = {
  onSuccess: (data: AuthTokensResponse) => void;
  onError: (message: string) => void;
  disabled?: boolean;
};

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();

  const existing = document.getElementById('google-gsi');
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'google-gsi';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.body.appendChild(script);
  });
}

/**
 * Official Google button only — no custom account-picker modal.
 * Click goes straight into Google’s sign-in / account chooser.
 */
export function GoogleSignInButton({ onSuccess, onError, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const buttonHostRef = useRef<HTMLDivElement>(null);
  const finishRef = useRef<(idToken: string) => Promise<void>>(async () => {});

  const finishWithGoogleToken = useCallback(
    async (idToken: string) => {
      setBusy(true);
      try {
        const { data } = await api<AuthTokensResponse>('/api/auth/google', {
          method: 'POST',
          auth: false,
          body: JSON.stringify({ idToken }),
        });
        onSuccess(data);
      } catch (err) {
        onError(err instanceof ApiError ? err.message : 'Google sign-in failed');
      } finally {
        setBusy(false);
      }
    },
    [onError, onSuccess],
  );

  finishRef.current = finishWithGoogleToken;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    void (async () => {
      try {
        await loadGisScript();
        if (cancelled || !window.google?.accounts?.id || !buttonHostRef.current) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential: string }) => {
            void finishRef.current(response.credential);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        buttonHostRef.current.innerHTML = '';
        // Full-width-ish official Google button — this is the only CTA (no modal).
        window.google.accounts.id.renderButton(buttonHostRef.current, {
          theme: 'outline',
          size: 'large',
          width: Math.min(400, buttonHostRef.current.parentElement?.clientWidth || 360),
          text: 'signin_with',
          shape: 'pill',
          logo_alignment: 'left',
        });
        setReady(true);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Google Sign-In failed to load');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onError]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
        Google sign-in is not configured on this environment.
      </p>
    );
  }

  return (
    <div
      className={`flex w-full flex-col items-center ${disabled || busy ? 'pointer-events-none opacity-60' : ''}`}
    >
      {!ready ? (
        <div className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-white text-sm font-semibold text-muted-foreground">
          Loading Google…
        </div>
      ) : null}
      <div ref={buttonHostRef} className={`w-full max-w-full ${ready ? '' : 'hidden'}`} />
      {busy ? <p className="mt-2 text-xs font-medium text-muted-foreground">Signing in…</p> : null}
    </div>
  );
}
