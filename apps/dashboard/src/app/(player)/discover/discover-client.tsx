'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SportDto, VenueListItem } from '@playpk/shared-types';
import { formatPkr } from '@/lib/utils';
import { SportFilterRail } from '@/components/sport-filter-rail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DEFAULT_VENUE_FILTERS,
  useSports,
  useVenues,
  type VenueFilters,
} from '@/hooks/use-venues';

type Props = {
  initialVenues: VenueListItem[];
  initialSports: SportDto[];
};

export function DiscoverClient({ initialVenues, initialSports }: Props) {
  const [draft, setDraft] = useState<VenueFilters>(DEFAULT_VENUE_FILTERS);
  const [applied, setApplied] = useState<VenueFilters>(DEFAULT_VENUE_FILTERS);

  const { data: sports = initialSports } = useSports(initialSports);
  const {
    data: venues = initialVenues,
    isFetching,
    error,
  } = useVenues(applied, { initialData: initialVenues });

  function applyFilters() {
    setApplied({ ...draft });
  }

  function clearFilters() {
    setDraft(DEFAULT_VENUE_FILTERS);
    setApplied(DEFAULT_VENUE_FILTERS);
  }

  const hasExtraFilters =
    applied.sport || applied.minPrice || applied.maxPrice || applied.minRating;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Near you</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy sm:text-3xl">{applied.city}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse venues, pick a sport, and book available courts.
        </p>
      </div>

      <SportFilterRail
        sports={sports}
        value={draft.sport}
        onChange={(sport) => setDraft((f) => ({ ...f, sport }))}
        featuredOnly={false}
        showAll
        size="md"
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Refine venues by city, sport, price, and rating</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="home-city">City</Label>
              <Input
                id="home-city"
                value={draft.city}
                onChange={(e) => setDraft((f) => ({ ...f, city: e.target.value }))}
                placeholder="Lahore"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="home-sport">Sport</Label>
              <select
                id="home-sport"
                value={draft.sport}
                onChange={(e) => setDraft((f) => ({ ...f, sport: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All sports</option>
                {sports.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="home-min-price">Min price / hr (PKR)</Label>
              <Input
                id="home-min-price"
                inputMode="numeric"
                value={draft.minPrice}
                onChange={(e) => setDraft((f) => ({ ...f, minPrice: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="home-max-price">Max price / hr (PKR)</Label>
              <Input
                id="home-max-price"
                inputMode="numeric"
                value={draft.maxPrice}
                onChange={(e) => setDraft((f) => ({ ...f, maxPrice: e.target.value }))}
                placeholder="5000"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="home-min-rating">Min rating (1–5)</Label>
              <Input
                id="home-min-rating"
                inputMode="decimal"
                value={draft.minRating}
                onChange={(e) => setDraft((f) => ({ ...f, minRating: e.target.value }))}
                placeholder="4.0"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={applyFilters} disabled={isFetching}>
              {isFetching ? 'Loading…' : 'Apply filters'}
            </Button>
            {hasExtraFilters ? (
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load venues'}
        </p>
      ) : null}

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

      {!isFetching && venues.length === 0 ? (
        <p className="text-sm text-muted-foreground">No venues found for these filters.</p>
      ) : null}
    </div>
  );
}
