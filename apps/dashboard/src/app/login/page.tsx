'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { AuthTokensResponse } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { clearSession, getStoredUser, saveSession } from '@/lib/auth';
import { homePathForRole, isPlayerRole } from '@/lib/roles';
import { LOGIN_HERO_IMAGE } from '@/lib/venue-cover';
import { AmbientGradient } from '@/components/ambient-gradient';
import { GoogleSignInButton, rememberGoogleAccount } from '@/components/google-sign-in';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type DemoAccount = {
  label: string;
  email: string;
  password: string;
  opens: string;
};

type Mode = 'signin' | 'signup' | 'verify';

/** Demo credentials never ship in production builds unless explicitly enabled. */
const SHOW_DEMO_LOGINS =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === 'true';

const DEMOS: DemoAccount[] = SHOW_DEMO_LOGINS
  ? [
      {
        label: 'Customer 1',
        email: 'player@playpk.demo',
        password: 'PlayPK@player1',
        opens: 'Book courts & play',
      },
      {
        label: 'Customer 2',
        email: 'player2@playpk.demo',
        password: 'PlayPK@player2',
        opens: 'Join matches & play',
      },
      {
        label: 'Company · GameOn',
        email: 'owner@playpk.demo',
        password: 'PlayPK@demo1',
        opens: 'Manage venues',
      },
      {
        label: 'Company · 360 Arena',
        email: 'owner360@playpk.demo',
        password: 'PlayPK@3601',
        opens: 'Manage venues',
      },
      {
        label: 'Admin',
        email: 'admin@playpk.demo',
        password: 'PlayPK@admin1',
        opens: 'Platform admin',
      },
    ]
  : [];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Keep Google accounts for the picker after sign-out.
    const existing = getStoredUser();
    if (existing?.email) {
      rememberGoogleAccount({ email: existing.email, name: existing.name });
    }
    clearSession();
  }, []);

  function safeNextPath(role: string): string {
    const next =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('next')
        : null;
    if (
      next &&
      next.startsWith('/') &&
      !next.startsWith('//') &&
      isPlayerRole(role) &&
      (next.startsWith('/my-tournaments') ||
        next.startsWith('/events') ||
        next.startsWith('/discover') ||
        next.startsWith('/play') ||
        next.startsWith('/social') ||
        next.startsWith('/me') ||
        next.startsWith('/rank'))
    ) {
      return next;
    }
    return homePathForRole(role);
  }

  function completeAuth(data: AuthTokensResponse) {
    const allowed = ['PLAYER', 'COMPANY_OWNER', 'BRANCH_MANAGER', 'ADMIN'];
    if (!allowed.includes(String(data.user.role))) {
      setError('Unsupported account role for this portal.');
      return;
    }
    if (data.user.email) {
      rememberGoogleAccount({ email: data.user.email, name: data.user.name });
    }
    saveSession(data);
    router.replace(safeNextPath(String(data.user.role)));
  }

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const { data } = await api<AuthTokensResponse>('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      completeAuth(data);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function onCreateAccount(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    setDevOtp(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const { data } = await api<{
        phone: string;
        message: string;
        expiresInSeconds: number;
        devOtp?: string;
      }>('/api/auth/register/start', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          confirmPassword,
        }),
      });
      setPendingPhone(data.phone);
      if (data.devOtp) setDevOtp(data.devOtp);
      setInfo(data.message);
      setMode('verify');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await api<AuthTokensResponse>('/api/auth/register/verify', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ phone: pendingPhone, code: otpCode.trim() }),
      });
      completeAuth(data);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-2">
      <div className="relative hidden min-h-screen overflow-hidden lg:block">
        <Image
          src={LOGIN_HERO_IMAGE}
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/70 to-navy/30" />
        <div className="relative z-10 flex h-full flex-col justify-end p-10 xl:p-14">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-brand">PlayPK</p>
          <h1 className="font-display mt-3 max-w-md text-4xl font-extrabold leading-tight text-white xl:text-5xl">
            Your sports community in Pakistan
          </h1>
          <p className="mt-3 max-w-sm text-base text-white/70">
            Book courts, join open matches, and climb the ranks — all in one place.
          </p>
        </div>
      </div>

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
        <div className="pointer-events-none absolute inset-0 lg:hidden">
          <AmbientGradient intensity="subtle" />
          <div className="absolute inset-0 bg-navy/80" />
        </div>

        <div className="relative w-full max-w-md animate-rise rounded-3xl bg-white p-6 shadow-panel sm:p-8">
          <p className="font-display text-2xl font-extrabold text-navy">
            Play<span className="text-brand">PK</span>
          </p>

          {mode === 'verify' ? (
            <>
              <h2 className="font-display mt-4 text-2xl font-bold text-navy sm:text-3xl">
                Verify phone
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Enter the 6-digit code sent to <span className="font-semibold text-navy">{pendingPhone}</span>.
              </p>
              {devOtp ? (
                <p className="mt-3 rounded-xl bg-brand/10 px-3 py-2 text-xs font-semibold text-navy">
                  Localhost mock SMS code: <span className="font-mono text-brand-700">{devOtp}</span>
                </p>
              ) : null}
              <form className="mt-6 space-y-4" onSubmit={onVerifyOtp}>
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification code</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    className="h-11 rounded-xl tracking-[0.3em]"
                  />
                </div>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                {info ? <p className="text-sm text-brand-700">{info}</p> : null}
                <Button
                  className="h-11 w-full rounded-xl bg-navy text-base font-bold hover:bg-brand"
                  disabled={loading || otpCode.length !== 6}
                  type="submit"
                >
                  {loading ? 'Creating account…' : 'Verify & register'}
                </Button>
                <button
                  type="button"
                  className="w-full text-sm font-semibold text-muted-foreground hover:text-navy"
                  onClick={() => {
                    setMode('signup');
                    setOtpCode('');
                    setError(null);
                    setInfo(null);
                  }}
                >
                  ← Back to create account
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-display mt-4 text-2xl font-bold text-navy sm:text-3xl">
                {mode === 'signin' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {mode === 'signin'
                  ? 'Sign in to book courts or manage your venues.'
                  : 'Register as a customer. We’ll verify your phone number.'}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-[#EEF3F0] p-1">
                <button
                  type="button"
                  className={`h-9 rounded-lg text-sm font-bold transition ${
                    mode === 'signin' ? 'bg-white text-navy shadow-sm' : 'text-muted-foreground'
                  }`}
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setInfo(null);
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={`h-9 rounded-lg text-sm font-bold transition ${
                    mode === 'signup' ? 'bg-white text-navy shadow-sm' : 'text-muted-foreground'
                  }`}
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                    setInfo(null);
                  }}
                >
                  Create account
                </button>
              </div>

              <div className="mt-5">
                <GoogleSignInButton
                  disabled={loading}
                  onSuccess={completeAuth}
                  onError={(msg) => setError(msg)}
                />
              </div>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  or
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {mode === 'signin' ? (
                <form className="space-y-4" onSubmit={onSignIn}>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                  <Button
                    className="h-11 w-full rounded-xl bg-navy text-base font-bold hover:bg-brand"
                    disabled={loading}
                    type="submit"
                  >
                    {loading ? 'Signing in…' : 'Sign in'}
                  </Button>
                </form>
              ) : (
                <form className="space-y-3" onSubmit={onCreateAccount}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First name</Label>
                      <Input
                        id="firstName"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last name</Label>
                      <Input
                        id="lastName"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Phone number</Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="03001234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Create password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                  <Button
                    className="h-11 w-full rounded-xl bg-navy text-base font-bold hover:bg-brand"
                    disabled={loading}
                    type="submit"
                  >
                    {loading ? 'Sending code…' : 'Continue — verify phone'}
                  </Button>
                </form>
              )}

              {mode === 'signin' && DEMOS.length > 0 ? (
                <div className="mt-6 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Quick demo accounts
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {DEMOS.map((demo) => (
                      <button
                        key={demo.email}
                        type="button"
                        className="rounded-xl border border-border bg-[#EEF3F0] px-3 py-2.5 text-left transition hover:border-brand/40 hover:bg-brand/5"
                        onClick={() => {
                          setEmail(demo.email);
                          setPassword(demo.password);
                          setError(null);
                        }}
                      >
                        <span className="block text-sm font-semibold text-navy">{demo.label}</span>
                        <span className="block text-[11px] text-muted-foreground">{demo.opens}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatAuthError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) {
    return 'Cannot reach API. Start the API on localhost:4000, or check that Railway is up for production.';
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}
