'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { TournamentDto } from '@playpk/shared-types';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function EventsPage() {
  const [items, setItems] = useState<TournamentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const city = 'Lahore';

  useEffect(() => {
    setLoading(true);
    api<TournamentDto[]>(`/api/tournaments?city=${encodeURIComponent(city)}`, { auth: false })
      .then(({ data }) => setItems(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Compete</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-navy">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Venue tournaments near {city}. Open an event to register — hosted by listed companies.
          </p>
        </div>
        <Link
          href="/my-tournaments"
          className="inline-flex h-10 items-center rounded-xl border border-border bg-white px-4 text-sm font-semibold text-navy hover:border-brand/40"
        >
          My registrations
        </Link>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading events…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{item.name}</CardTitle>
              <CardDescription>
                {item.sport?.name} · {item.branch?.name} · {item.format}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">{item.status}</Badge>
                <Badge>{formatPkr(item.entryFee)} entry</Badge>
                <Badge variant="muted">{item.registrationCount ?? 0} joined</Badge>
              </div>
              <p className="text-muted-foreground">
                {String(item.startDate).slice(0, 10)} → {String(item.endDate).slice(0, 10)}
              </p>
              <Link
                href={`/events/${item.id}`}
                className="inline-flex text-sm font-semibold text-brand hover:underline"
              >
                View & register →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && items.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">No tournaments in this city yet.</p>
      ) : null}
    </div>
  );
}
