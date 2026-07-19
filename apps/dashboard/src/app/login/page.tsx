'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthTokensResponse } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { clearSession, saveSession } from '@/lib/auth';
import { homePathForRole } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type DemoAccount = {
  label: string;
  email: string;
  password: string;
  opens: string;
};

const DEMOS: DemoAccount[] = [
  {
    label: 'Customer',
    email: 'player@playpk.demo',
    password: 'PlayPK@player1',
    opens: 'Opens customer book app',
  },
  {
    label: 'Company · GameOn',
    email: 'owner@playpk.demo',
    password: 'PlayPK@demo1',
    opens: 'Opens company dashboard',
  },
  {
    label: 'Company · 360 Arena',
    email: 'owner360@playpk.demo',
    password: 'PlayPK@3601',
    opens: 'Opens company dashboard',
  },
  {
    label: 'Admin',
    email: 'admin@playpk.demo',
    password: 'PlayPK@admin1',
    opens: 'Opens admin dashboard',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Always start at Sign in — clear any previous session so this page is first.
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
      // Customer → /discover · Company → /companies · Admin → /admin
      router.replace(homePathForRole(String(data.user.role)));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof TypeError) {
        setError(
          'Cannot reach API. On Vercel set API_URL to your public HTTPS API (e.g. Railway), redeploy, and keep that API running.',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,166,81,0.28),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.08),transparent_35%)]" />
      <Card className="relative w-full max-w-md border-0 shadow-panel">
        <CardHeader>
          <div className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-brand">
            PlayPK
          </div>
          <CardTitle className="text-2xl">Sign in first</CardTitle>
          <CardDescription>
            Use your customer, company, or admin email and password. After Sign in you open that
            account&apos;s dashboard only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email / username</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-5 space-y-2">
            <p className="text-xs text-muted-foreground">
              Tap a demo to fill email + password, then Sign in:
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMOS.map((demo) => (
                <Button
                  key={demo.email}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-auto flex-col items-start gap-0.5 py-2.5 text-left"
                  onClick={() => {
                    setEmail(demo.email);
                    setPassword(demo.password);
                    setError(null);
                  }}
                >
                  <span className="font-semibold text-navy">{demo.label}</span>
                  <span className="text-[10px] font-normal text-muted-foreground">{demo.opens}</span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
