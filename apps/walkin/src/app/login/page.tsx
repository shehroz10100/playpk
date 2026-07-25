'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthTokensResponse } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { clearSession, saveSession, saveSelectedBranch } from '@/lib/auth';

type Company = {
  id: string;
  name: string;
  branches: Array<{ id: string; name: string; city: string }>;
};

const STAFF_ROLES = new Set(['FRONT_DESK', 'BRANCH_MANAGER', 'COMPANY_OWNER', 'ADMIN']);

const SHOW_DEMO_LOGINS =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === 'true';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(SHOW_DEMO_LOGINS ? 'frontdesk@playpk.demo' : '');
  const [password, setPassword] = useState(SHOW_DEMO_LOGINS ? 'PlayPK@desk1' : '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[] | null>(null);

  useEffect(() => {
    clearSession();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api<AuthTokensResponse>('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!STAFF_ROLES.has(String(data.user.role))) {
        setError('This portal is for front-desk / venue staff only.');
        return;
      }
      saveSession(data);
      const list = await api<Company[]>('/api/companies');
      const withBranches = list.filter((c) => c.branches?.length);
      if (withBranches.length === 1 && withBranches[0].branches.length === 1) {
        saveSelectedBranch(withBranches[0].branches[0].id);
        router.replace('/desk');
        return;
      }
      setCompanies(withBranches);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function pickBranch(branchId: string) {
    saveSelectedBranch(branchId);
    router.replace('/desk');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-navy/10 bg-white/90 p-8 shadow-sm backdrop-blur">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-brand">
          Walk-in desk
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold text-navy">Staff sign in</h1>
        <p className="mt-2 text-sm text-navy/60">
          Book walk-ins against the same live inventory as the online app.
        </p>

        {!companies ? (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block text-sm font-medium text-navy">
              Email
              <input
                className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-base outline-none focus:border-brand"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="block text-sm font-medium text-navy">
              Password
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-base outline-none focus:border-brand"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand py-3.5 text-base font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            {SHOW_DEMO_LOGINS ? (
              <p className="text-xs text-navy/50">
                Demo: frontdesk@playpk.demo / PlayPK@desk1
              </p>
            ) : null}
          </form>
        ) : (
          <div className="mt-8 space-y-3">
            <p className="text-sm font-medium text-navy">Select branch</p>
            {companies.flatMap((c) =>
              c.branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => pickBranch(b.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-navy/10 bg-navy/[0.03] px-4 py-4 text-left hover:border-brand"
                >
                  <span>
                    <span className="block font-semibold text-navy">{b.name}</span>
                    <span className="text-xs text-navy/50">
                      {c.name} · {b.city}
                    </span>
                  </span>
                  <span className="text-brand">Open →</span>
                </button>
              )),
            )}
          </div>
        )}
      </div>
    </main>
  );
}
