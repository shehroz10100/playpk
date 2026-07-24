'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { TournamentDto } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MyTournamentsPage() {
  const [mine, setMine] = useState<TournamentDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api<TournamentDto[]>('/api/tournaments/mine');
      setMine(data);
    } catch (err) {
      setMine([]);
      setError(err instanceof ApiError ? err.message : 'Failed to load your tournaments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Compete</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-navy">My tournaments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Venue tournaments you registered for. New events are created by listed companies only.
          </p>
        </div>
        <Link href="/events" className="text-sm font-semibold text-brand hover:underline">
          Browse venue events →
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-navy">Registered</h2>
        {!loading && mine.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-navy/15 bg-white px-4 py-8 text-center text-sm text-muted-foreground">
            You haven&apos;t registered for a venue tournament yet.{' '}
            <Link href="/events" className="font-semibold text-brand hover:underline">
              Browse events
            </Link>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((item) => (
              <Link key={item.id} href={`/events/${item.id}`}>
                <Card className="h-full rounded-2xl border-0 shadow-panel transition hover:-translate-y-0.5">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={item.status === 'CANCELLED' ? 'warn' : 'success'}>
                        {item.status}
                      </Badge>
                      <Badge variant="muted">Venue event</Badge>
                    </div>
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <CardDescription>
                      {item.sport?.name} · {item.branch?.name} · {item.format}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>
                      {formatPkr(item.entryFee)} entry · {item.registrationCount ?? 0} joined
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
