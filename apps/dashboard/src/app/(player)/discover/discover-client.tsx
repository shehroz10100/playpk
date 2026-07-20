'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Calendar,
  ChevronDown,
  MapPin,
  SlidersHorizontal,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import type { OpenMatchDto, SportDto, TournamentDto, VenueListItem } from '@playpk/shared-types';
import { resolveSportCover } from '@playpk/shared-types';
import { SportFilterRail } from '@/components/sport-filter-rail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { formatLabel } from '@/lib/match-formats';
import { formatPkr, cn } from '@/lib/utils';
import { DISCOVER_HERO_IMAGE, resolveVenueCover } from '@/lib/venue-cover';
import {
  DEFAULT_VENUE_FILTERS,
  useSports,
  useVenues,
  type VenueFilters,
} from '@/hooks/use-venues';

const CATEGORY_CARD =
  'group relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-navy via-[#16345a] to-[#0c6b3e] px-3 py-8 shadow-panel transition hover:-translate-y-0.5 hover:shadow-lg sm:py-10';

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
      .then(({ data }) => setTournaments(data.slice(0, 8)))
      .catch(() => setTournaments([]));
    api<OpenMatchDto[]>(`/api/social/matches?city=${encodeURIComponent(city)}`)
      .then(({ data }) => setMatches(data.slice(0, 6)))
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
    <div className="space-y-7 sm:space-y-9">
      {/* Hero */}
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
          <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/75 to-navy/35" />
          <div className="relative z-10 flex h-full min-h-[200px] flex-col justify-end gap-4 px-5 py-6 sm:min-h-[240px] sm:px-8 sm:py-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">PlayPK</p>
              <h1 className="font-display mt-2 max-w-lg text-2xl font-extrabold leading-tight text-white sm:text-4xl">
                Host your own open match
              </h1>
              <p className="mt-2 max-w-md text-sm text-white/75">
                Looking for players to join your match? Organize open matches and fill spots with
                ease.
              </p>
            </div>
            <Link
              href="/play?create=1"
              className="inline-flex h-11 w-fit items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-navy transition hover:bg-brand hover:text-white"
            >
              Create Match
            </Link>
          </div>
        </div>
      </section>

      {/* Sport filters — above venues */}
      <section className="space-y-3 animate-rise" style={{ animationDelay: '40ms' }}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-navy sm:text-xl">Sports</h2>
            <p className="text-sm text-muted-foreground">Filter venues by sport</p>
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
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
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
              <Label htmlFor="home-min-price">Min price / hr</Label>
              <Input
                id="home-min-price"
                inputMode="numeric"
                value={draft.minPrice}
                onChange={(e) => setDraft((f) => ({ ...f, minPrice: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="home-max-price">Max price / hr</Label>
              <Input
                id="home-max-price"
                inputMode="numeric"
                value={draft.maxPrice}
                onChange={(e) => setDraft((f) => ({ ...f, maxPrice: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={applyFilters} disabled={isFetching} className="rounded-xl">
              {isFetching ? 'Loading…' : 'Apply'}
            </Button>
            {hasExtraFilters ? (
              <Button type="button" variant="outline" onClick={clearFilters} className="rounded-xl">
                Clear
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Venues swipe carousel */}
      <section className="space-y-3 animate-rise" style={{ animationDelay: '60ms' }}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-navy sm:text-xl">
            Venues in {applied.city}
          </h2>
          <button
            type="button"
            className="text-sm font-semibold text-brand"
            onClick={() => setFiltersOpen(true)}
          >
            View all
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-600">
            {error instanceof Error ? error.message : 'Failed to load venues'}
          </p>
        ) : null}
        <div className="sport-rail -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {venues.map((venue) => {
            const cover = resolveVenueCover(venue);
            return (
              <Link
                key={venue.id}
                href={`/venues/${venue.id}`}
                className="w-[78%] max-w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-panel sm:w-[240px]"
              >
                <div className="relative aspect-[16/10]">
                  <Image src={cover} alt="" fill sizes="280px" className="object-cover" />
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-1 font-bold text-navy">{venue.name}</p>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">
                    {venue.sports
                      .slice(0, 3)
                      .map((s) => s.name)
                      .join(' · ') || venue.company.name}
                  </p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs font-bold text-navy">
                      {venue.minPrice != null
                        ? `Starting at ${formatPkr(venue.minPrice)}/hr`
                        : 'View courts'}
                    </p>
                    <span className="text-xs font-semibold text-brand">
                      {venue.avgRating != null ? `★ ${venue.avgRating.toFixed(1)}` : 'New'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
          {!isFetching && venues.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">No venues for these filters.</p>
          ) : null}
        </div>
      </section>

      {/* Categories — same color scheme */}
      <section className="animate-rise" style={{ animationDelay: '80ms' }}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Link href="/events" className={CATEGORY_CARD}>
            <span
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand/30 blur-2xl"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl"
              aria-hidden
            />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-md transition group-hover:scale-105 sm:h-16 sm:w-16">
              <Trophy className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.75} />
            </span>
            <span className="relative text-center font-display text-sm font-bold text-white sm:text-base">
              Tournaments
            </span>
            <span className="relative text-center text-[11px] font-medium text-white/70 sm:text-xs">
              Compete &amp; win
            </span>
          </Link>

          <Link href="/play" className={CATEGORY_CARD}>
            <span
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand/30 blur-2xl"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl"
              aria-hidden
            />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-md transition group-hover:scale-105 sm:h-16 sm:w-16">
              <Swords className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.75} />
            </span>
            <span className="relative text-center font-display text-sm font-bold text-white sm:text-base">
              Match &amp; Play
            </span>
            <span className="relative text-center text-[11px] font-medium text-white/70 sm:text-xs">
              Find a game
            </span>
          </Link>
        </div>
      </section>

      {/* Upcoming matches */}
      <section className="space-y-3 animate-rise" style={{ animationDelay: '100ms' }}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-navy sm:text-xl">Upcoming Matches</h2>
          <Link href="/play" className="text-sm font-semibold text-brand">
            View all
          </Link>
        </div>
        {matches.length === 0 ? (
          <Link
            href="/play?create=1"
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-panel"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Swords className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-semibold text-navy">No matches yet</span>
              <span className="text-sm text-muted-foreground">Create an open match to get started</span>
            </span>
          </Link>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => {
              const spotsLeft = Math.max(0, m.maxPlayers - m.joinedCount);
              const when = m.scheduledAt
                ? new Date(m.scheduledAt).toLocaleString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Flexible time';
              return (
                <Link
                  key={m.id}
                  href={`/play/${m.id}`}
                  className="flex items-stretch gap-3 overflow-hidden rounded-2xl bg-white shadow-panel transition hover:-translate-y-0.5"
                >
                  <div className="relative hidden w-24 shrink-0 sm:block">
                    <Image
                      src={resolveSportCover(m.sport.name, m.sport.iconUrl)}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-center gap-1 px-3 py-3 sm:pr-2">
                    <span className="w-fit rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                      Open Match
                    </span>
                    <p className="font-bold text-navy">
                      {m.sport.name} · {formatLabel(m.format)}
                    </p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{m.title}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-brand" />
                        {m.city ?? applied.city}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-brand" />
                        {when}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3 text-brand" />
                        {spotsLeft} spots left
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-center gap-2 px-3 py-3">
                    <span className="text-xs font-bold text-navy">
                      {m.joinedCount}/{m.maxPlayers}
                    </span>
                    <span className="inline-flex h-9 items-center rounded-xl bg-brand px-3 text-xs font-bold text-white">
                      Join
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Tournaments strip */}
      <section className="space-y-3 animate-rise" style={{ animationDelay: '120ms' }}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-navy sm:text-xl">Tournaments</h2>
          <div className="flex gap-3">
            <Link href="/my-tournaments" className="text-sm font-semibold text-navy hover:text-brand">
              My tournaments
            </Link>
            <Link href="/events" className="text-sm font-semibold text-brand">
              View all
            </Link>
          </div>
        </div>
        {tournaments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-navy/15 bg-white/70 px-4 py-6 text-sm text-muted-foreground">
            No tournaments in {applied.city} yet.
          </p>
        ) : (
          <div className="sport-rail -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {tournaments.map((t) => {
              const cover = resolveSportCover(t.sport?.name ?? 'All', t.sport?.iconUrl);
              return (
                <Link
                  key={t.id}
                  href={`/events/${t.id}`}
                  className="w-[200px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-panel sm:w-[220px]"
                >
                  <div className="relative h-28">
                    <Image src={cover} alt="" fill sizes="220px" className="object-cover" />
                    <span className="absolute left-2 top-2 rounded-md bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                      {t.isCommunity ? 'Community' : 'Venue'}
                    </span>
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-2 text-sm font-bold text-navy">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.sport?.name} · {String(t.startDate).slice(0, 10)}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-bold text-navy">{formatPkr(t.entryFee)}</span>
                      <span className="rounded-lg bg-brand px-2.5 py-1 text-[10px] font-bold text-white">
                        Join
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
