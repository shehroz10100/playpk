'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SportDto, VenueListItem } from '@playpk/shared-types';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { SportFilterRail } from '@/components/sport-filter-rail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function DiscoverPage() {
  const [city, setCity] = useState('Lahore');
  const [sport, setSport] = useState('');
  const [sports, setSports] = useState<SportDto[]>([]);
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ city, pageSize: '30' });
      if (sport) query.set('sport', sport);
      const [venuesRes, sportsRes] = await Promise.all([
        api<VenueListItem[]>(`/api/venues?${query.toString()}`, { auth: false }),
        api<SportDto[]>('/api/sports', { auth: false }),
      ]);
      setVenues(venuesRes.data);
      setSports(sportsRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load venues');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Near you</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy sm:text-3xl">{city}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse venues, pick a sport, and book available courts.
        </p>
      </div>

      <SportFilterRail
        sports={sports}
        value={sport}
        onChange={setSport}
        featuredOnly={false}
        showAll
        size="md"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">City</label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lahore" />
        </div>
        <Button onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Apply filters'}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {venues.map((venue) => (
          <Card key={venue.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{venue.name}</CardTitle>
              <CardDescription>
                {venue.company.name} · {venue.address}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>
                  {venue.avgRating ? `${venue.avgRating.toFixed(1)}★` : 'New'}
                </Badge>
                <Badge variant="success">
                  {venue.minPrice != null ? `from ${formatPkr(venue.minPrice)}` : '—'}
                </Badge>
                <Badge variant="muted">{venue.courtCount} courts</Badge>
                {venue.sports.slice(0, 4).map((s) => (
                  <Badge key={s.id}>{s.name}</Badge>
                ))}
              </div>
              <Link
                href={`/venues/${venue.id}`}
                className="inline-flex h-9 items-center rounded-md bg-navy px-3 text-sm font-medium text-white hover:bg-navy-700"
              >
                View courts
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && venues.length === 0 ? (
        <p className="text-sm text-muted-foreground">No venues found for these filters.</p>
      ) : null}
    </div>
  );
}
