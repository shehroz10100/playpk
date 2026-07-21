'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { AuthTokensResponse } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { clearSession, saveSession } from '@/lib/auth';
import { homePathForRole } from '@/lib/roles';
import { LOGIN_HERO_IMAGE } from '@/lib/venue-cover';
import { AmbientGradient } from '@/components/ambient-gradient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type DemoAccount = {
  label: string;
  email: string;
  password: string;
  opens: string;
};

const DEMOS: DemoAccount[] = [
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
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    clearSession();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await api<AuthTokensResponse>('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const allowed = ['PLAYER', 'COMPANY_OWNER', 'BRANCH_MANAGER', 'ADMIN'];
      if (!allowed.includes(String(data.user.role))) {
        setError('Unsupported account role for this portal.');
        return;
      }

      saveSession(data);
      router.replace(homePathForRole(String(data.user.role)));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof TypeError) {
        setError(
          'Cannot reach API. Start the API on localhost:4000, or check that Railway is up for production.',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-2">
      {/* Desktop hero — static image banner (no shader grain) */}
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

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy px-4 py-10 lg:bg-[#EEF3F0]">
        <div className="pointer-events-none absolute inset-0 lg:hidden">
          <AmbientGradient intensity="subtle" />
          <div className="absolute inset-0 bg-navy/80" />
        </div>

        <div className="relative w-full max-w-md animate-rise rounded-3xl bg-white p-6 shadow-panel sm:p-8">
          <p className="font-display text-2xl font-extrabold text-navy">
            Play<span className="text-brand">PK</span>
          </p>
          <h2 className="font-display mt-4 text-2xl font-bold text-navy sm:text-3xl">Welcome back</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to book courts or manage your venues.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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
        </div>
      </div>
    </div>
  );
}
