'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { AuthTokensResponse } from '@playpk/shared-types';

const LOCAL_ACCOUNTS_KEY = 'playpk_local_google_accounts';
const LAST_GOOGLE_KEY = 'playpk_last_google_account';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || '';

export type LocalGoogleAccount = { email: string; name: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: Record<string, unknown>) => void;
          prompt: (cb?: (notification: { isNotDisplayed: () => boolean }) => void) => void;
          renderButton: (el: HTMLElement, cfg: Record<string, unknown>) => void;
        };
      };
    };
  }
}

function isGoogleEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  // Never treat demo/staff portal emails as Google accounts.
  if (e.endsWith('@playpk.demo')) return false;
  return e.endsWith('@gmail.com') || e.endsWith('@googlemail.com');
}

export function loadLocalGoogleAccounts(): LocalGoogleAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalGoogleAccount[];
    if (!Array.isArray(parsed)) return [];
    // Drop demo / non-Gmail entries left over from older builds.
    const cleaned = parsed.filter((a) => a?.email && isGoogleEmail(a.email));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

/** Only call after a real Google sign-in — never after email/password demo login. */
export function rememberGoogleAccount(account: LocalGoogleAccount) {
  if (typeof window === 'undefined') return;
  const email = account.email.trim().toLowerCase();
  if (!isGoogleEmail(email)) return;
  const name = (account.name || email.split('@')[0] || 'Player').trim();
  const next = [
    { email, name },
    ...loadLocalGoogleAccounts().filter((a) => a.email.toLowerCase() !== email),
  ].slice(0, 8);
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(next));
  localStorage.setItem(LAST_GOOGLE_KEY, JSON.stringify({ email, name }));
}

function loadLastGoogleAccount(): LocalGoogleAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_GOOGLE_KEY);
    if (!raw) return null;
    const account = JSON.parse(raw) as LocalGoogleAccount;
    if (!account?.email || !isGoogleEmail(account.email)) {
      localStorage.removeItem(LAST_GOOGLE_KEY);
      return null;
    }
    return account;
  } catch {
    return null;
  }
}

type Props = {
  onSuccess: (data: AuthTokensResponse) => void;
  onError: (message: string) => void;
  disabled?: boolean;
};

export function GoogleSignInButton({ onSuccess, onError, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<LocalGoogleAccount[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const gisBtnRef = useRef<HTMLDivElement>(null);

  const finishWithSession = useCallback(
    async (body: { idToken?: string; email?: string; name?: string }) => {
      setBusy(true);
      try {
        const { data } = await api<AuthTokensResponse>('/api/auth/google', {
          method: 'POST',
          auth: false,
          body: JSON.stringify(body),
        });
        const savedEmail = (body.email || data.user.email || '').toLowerCase();
        if (savedEmail) {
          rememberGoogleAccount({
            email: savedEmail,
            name: body.name || data.user.name || savedEmail.split('@')[0] || 'Player',
          });
        }
        onSuccess(data);
        setOpen(false);
      } catch (err) {
        onError(err instanceof ApiError ? err.message : 'Google sign-in failed');
      } finally {
        setBusy(false);
      }
    },
    [onError, onSuccess],
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !open) return;

    const existing = document.getElementById('google-gsi');
    const init = () => {
      if (!window.google?.accounts?.id || !gisBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => {
          void finishWithSession({ idToken: response.credential });
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      gisBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(gisBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'signin_with',
        shape: 'pill',
      });
      // Also open Google's account chooser (shows Gmails signed into this browser/device).
      window.google.accounts.id.prompt();
    };

    if (existing) {
      init();
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = init;
    document.body.appendChild(script);
  }, [finishWithSession, open]);

  function openPicker() {
    const saved = loadLocalGoogleAccounts();
    const last = loadLastGoogleAccount();
    const merged = [...saved];
    if (last && !merged.some((a) => a.email === last.email.toLowerCase())) {
      merged.unshift(last);
    }
    setAccounts(merged);
    if (last) {
      setEmail(last.email);
      setName(last.name);
    } else {
      setEmail('');
      setName('');
    }
    setOpen(true);
  }

  async function pickLocal(account: LocalGoogleAccount) {
    await finishWithSession({ email: account.email, name: account.name });
  }

  async function addAndContinue() {
    const cleaned = email.trim().toLowerCase();
    if (!isGoogleEmail(cleaned)) {
      onError('Enter a Gmail address (e.g. you@gmail.com)');
      return;
    }
    const display = name.trim() || cleaned.split('@')[0] || 'Player';
    await finishWithSession({ email: cleaned, name: display });
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={openPicker}
        className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-semibold text-navy transition hover:bg-[#F8FAFC] disabled:opacity-60"
      >
        <GoogleGlyph />
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose Google account"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-panel"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-navy">Choose a Google account</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {GOOGLE_CLIENT_ID
                    ? 'Pick from Google’s list (accounts on this device/browser), or a saved Gmail below.'
                    : 'Enter your Gmail (e.g. you@gmail.com). Demo emails like player@playpk.demo are not Google accounts — use Sign in for those.'}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm font-semibold text-muted-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            {GOOGLE_CLIENT_ID ? (
              <div className="mt-4 flex justify-center">
                <div ref={gisBtnRef} />
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              {accounts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  No Google accounts saved yet — add your Gmail below once, and it will appear here next time.
                </p>
              ) : (
                accounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    disabled={busy}
                    onClick={() => void pickLocal(account)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:border-brand/40 hover:bg-brand/5"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                      {(account.name || account.email).charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-navy">
                        {account.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {account.email}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Use another account
              </p>
              <input
                type="email"
                placeholder="name@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-xl border border-border px-3 text-sm text-navy outline-none focus:border-brand"
              />
              <input
                type="text"
                placeholder="Display name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 w-full rounded-xl border border-border px-3 text-sm text-navy outline-none focus:border-brand"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void addAndContinue()}
                className="h-10 w-full rounded-xl bg-navy text-sm font-bold text-white hover:bg-brand"
              >
                Continue with this Gmail
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.5l.1.1 6.2 5.2C39.2 36.3 44 31.5 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}
