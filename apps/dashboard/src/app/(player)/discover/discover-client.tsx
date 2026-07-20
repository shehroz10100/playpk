'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, SlidersHorizontal, Swords, Trophy } from 'lucide-react';
import type { OpenMatchDto, SportDto, TournamentDto, VenueListItem } from '@playpk/shared-types';
import { resolveSportCover } from '@playpk/shared-types';
import { SportFilterRail } from '@/components/sport-filter-rail';
import { VenueCard } from '@/components/venue-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { formatLabel } from '@/lib/match-formats';
import { formatPkr, cn } from '@/lib/utils';
import { DISCOVER_HERO_IMAGE } from '@/lib/venue-cover';
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tournaments, setTournaments] = useState<TournamentDto[]>([]);
  const [matches, setMatches] = useState<OpenMatchDto[]>([]);

  const { data: sports = initialSports } = useSports(initialSports);
  const {
    data: venues = initialVenues,
    isFetching,
    error,
  } = useVenues(applied, { initialData: initialVenues });

  useEffect(() => {
    const city = applied.city || 'Lahore';
    api<TournamentDto[]>(`/api/tournaments?city=${encodeURIComponent(city)}`, { auth: false })
      .then(({ data }) => setTournaments(data.slice(0, 6)))
      .catch(() => setTournaments([]));
    api<OpenMatchDto[]>(`/api/social/matches?city=${encodeURIComponent(city)}`)
      .then(({ data }) => setMatches(data.slice(0, 4)))
      .catch(() => setMatches([]));
  }, [applied.city]);

  function applyFilters() {
    setApplied({ ...draft });
    setFiltersOpen(false);
  }

  function clearFilters() {
    setDraft(DEFAULT_VENUE_FILTERS);
    setApplied(DEFAULT_VENUE_FILTERS);
  }

  function onSportChange(sport: string) {
    setDraft((f) => ({ ...f, sport }));
    setApplied((f) => ({ ...f, sport }));
  }

  const hasExtraFilters =
    applied.sport || applied.minPrice || applied.maxPrice || applied.minRating;

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative -mx-4 overflow-hidden sm:-mx-6 sm:rounded-3xl animate-fade-in">
        <div className="relative min-h-[200px] sm:min-h-[240px]">
          <Image
            src={DISCOVER_HERO_IMAGE}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/85 to-navy/40" />
          <div className="relative z-10 flex h-full min-h-[200px] flex-col justify-end px-5 py-6 sm:min-h-[240px] sm:px-8 sm:py-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">PlayPK</p>
            <h1 className="font-display mt-2 max-w-xl text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
              Book courts.
              <br />
              Find your game.
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/75 sm:text-base">
              Venues near <span className="font-semibold text-white">{applied.city}</span> — padel,
              cricket, futsal, and more.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3 animate-rise" style={{ animationDelay: '60ms' }}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-navy sm:text-xl">Pick a sport</h2>
            <p className="text-sm text-muted-foreground">Swipe and filter venues instantly</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 rounded-xl border-navy/15"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            <ChevronDown className={cn('h-4 w-4 transition', filtersOpen && 'rotate-180')} />
          </Button>
        </div>

        <SportFilterRail
          sports={sports}
          value={draft.sport}
          onChange={onSportChange}
          featuredOnly={false}
          showAll
          size="md"
        />
      </section>

      {filtersOpen ? (
        <section className="rounded-2xl border border-border/80 bg-white/90 p-4 shadow-panel backdrop-blur animate-rise sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="home-city">City</Label>
              <Input
                id="home-city"
                value={draft.city}
                onChange={(e) => setDraft((f) => ({ ...f, city: e.target.value }))}
                placeholder="Lahore"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="home-sport">Sport</Label>
              <select
                id="home-sport"
                value={draft.sport}
                onChange={(e) => setDraft((f) => ({ ...f, sport: e.target.value }))}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
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
                className="rounded-xl"
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
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="home-min-rating">Min rating (1–5)</Label>
              <Input
                id="home-min-rating"
                inputMode="decimal"
                value={draft.minRating}
                onChange={(e) => setDraft((f) => ({ ...f, minRating: e.target.value }))}
                placeholder="Optional"
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={applyFilters} disabled={isFetching} className="rounded-xl">
              {isFetching ? 'Loading…' : 'Apply filters'}
            </Button>
            {hasExtraFilters ? (
              <Button type="button" variant="outline" onClick={clearFilters} className="rounded-xl">
                Clear
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-3 animate-rise" style={{ animationDelay: '90ms' }}>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Compete</p>
            <h2 className="font-display text-lg font-bold text-navy sm:text-xl">Tournaments</h2>
          </div>
          <div className="flex gap-2">
            <Link href="/my-tournaments" className="text-sm font-semibold text-navy hover:text-brand">
              My tournaments
            </Link>
            <Link href="/events" className="text-sm font-semibold text-brand hover:underline">
              See all →
            </Link>
          </div>
        </div>
        {tournaments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-navy/15 bg-white/70 px-4 py-6 text-sm text-muted-foreground">
            No open tournaments in {applied.city} yet. Companies and players can create one — it
            appears here.
          </div>
        ) : (
          <div className="sport-rail flex gap-3 overflow-x-auto pb-1">
            {tournaments.map((t) => {
              const cover = resolveSportCover(t.sport?.name ?? 'All', t.sport?.iconUrl);
              return (
                <Link
                  key={t.id}
                  href={`/events/${t.id}`}
                  className="relative w-[220px] shrink-0 overflow-hidden rounded-2xl bg-navy shadow-panel sm:w-[240px]"
                >
                  <div className="relative h-28">
                    <Image src={cover} alt="" fill sizes="240px" className="object-cover opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent" />
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                      <Trophy className="h-3 w-3" />
                      {t.isCommunity ? 'Community' : 'Venue'}
                    </span>
                  </div>
                  <div className="space-y-1 p-3 text-white">
                    <p className="line-clamp-1 text-sm font-bold">{t.name}</p>
                    <p className="text-[11px] text-white/65">
                      {t.sport?.name} · {t.branch?.name}
                    </p>
                    <p className="text-xs font-semibold text-brand-100">
                      {formatPkr(t.entryFee)} entry · {t.registrationCount ?? 0} joined
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3 animate-rise" style={{ animationDelay: '120ms' }}>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Match &amp; Play</p>
            <h2 className="font-display text-lg font-bold text-navy sm:text-xl">Open matches</h2>
          </div>
          <Link href="/play" className="text-sm font-semibold text-brand hover:underline">
            Play hub →
          </Link>
        </div>
        {matches.length === 0 ? (
          <Link
            href="/play"
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-panel transition hover:-translate-y-0.5"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Swords className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-semibold text-navy">Host or join an open match</span>
              <span className="text-sm text-muted-foreground">
                Public/private · friendly/competitive · cricket 8/10/14
              </span>
            </span>
          </Link>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {matches.map((m) => (
              <Link
                key={m.id}
                href={`/play/${m.id}`}
                className="rounded-2xl bg-white p-4 shadow-panel transition hover:-translate-y-0.5"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand">
                  {m.sport.name} · {formatLabel(m.format)}
                </p>
                <p className="mt-1 font-semibold text-navy">{m.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.joinedCount}/{m.maxPlayers} players · {m.matchType.toLowerCase()} ·{' '}
                  {m.city ?? applied.city}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-navy sm:text-xl">
            Venues in {applied.city}
          </h2>
          <p className="text-sm font-medium text-muted-foreground">
            {isFetching ? 'Updating…' : `${venues.length} spot${venues.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {error ? (
          <p className="text-sm text-red-600">
            {error instanceof Error ? error.message : 'Failed to load venues'}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue, i) => (
            <VenueCard key={venue.id} venue={venue} index={i} />
          ))}
        </div>

        {!isFetching && venues.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-navy/20 bg-white/60 px-6 py-12 text-center">
            <p className="font-display text-lg font-bold text-navy">No venues found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try another city or clear filters.</p>
            <Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={clearFilters}>
              Reset filters
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
