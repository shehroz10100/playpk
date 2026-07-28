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
import {
  formatMatchWhen,
  genderLabel,
  isUpcomingOpenMatch,
  matchVenueLine,
  skillBandLabel,
} from '@/lib/match-details';
import { formatLabel } from '@/lib/match-formats';
import { formatPkr, cn } from '@/lib/utils';
import { HERO_CLIP } from '@/lib/media-assets';
import { AmbientPromo } from '@/components/ambient-gradient';
import { HeroMedia } from '@/components/media/hero-media';
import { CountUp } from '@/components/motion/count-up';
import { MotionPress, MotionReveal } from '@/components/motion/motion-reveal';
import { StadiumSkeleton } from '@/components/motion/stadium-skeleton';
import { PlayerEmptyState } from '@/components/player-empty-state';
import { Badge } from '@/components/ui/badge';
import { VenueCard } from '@/components/venue-card';
import {
  DEFAULT_VENUE_FILTERS,
  useSports,
  useVenues,
  type VenueFilters,
} from '@/hooks/use-venues';

const CATEGORY_CARD =
  'group relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-navy via-[#16345a] to-[#0c6b3e] px-3 py-8 shadow-panel sm:py-10';

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
      .then(({ data }) => setMatches(data.filter(isUpcomingOpenMatch).slice(0, 6)))
      .catch(() => setMatches([]));
  }, [applied.city]);

  function applyFilters() {
    setApplied({ ...draft });
    setFiltersOpen(false);
  }

  function searchFromHero() {
    const next = { ...draft, city: draft.city.trim() || 'Lahore' };
    setDraft(next);
    setApplied(next);
    setFiltersOpen(false);
    if (typeof document !== 'undefined') {
      document.getElementById('home-venues')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
    Boolean(applied.sport) ||
    Boolean(applied.minPrice) ||
    Boolean(applied.maxPrice) ||
    Boolean(applied.minRating);

  return (
    <div className="space-y-5 sm:space-y-9">
      {/* Hero — flush under header, full-bleed on mobile */}
      <section className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen overflow-hidden sm:left-auto sm:right-auto sm:ml-0 sm:mr-0 sm:w-auto sm:-mx-6 sm:rounded-3xl animate-fade-in">
        <HeroMedia
          clip={HERO_CLIP}
          autoPlay
          className="sm:rounded-3xl"
          minClassName="min-h-[300px] sm:min-h-[320px]"
        >
          <div className="flex min-h-[300px] flex-col justify-end gap-3.5 px-4 py-5 sm:min-h-[320px] sm:gap-5 sm:px-8 sm:py-9">
            <div>
              <p className="hidden font-display text-2xl font-bold tracking-tight text-white sm:block sm:text-3xl">
                Play<span className="text-brand">PK</span>
              </p>
              <h1 className="font-display max-w-xl text-[1.65rem] font-bold uppercase leading-[0.98] tracking-tight text-white drop-shadow-sm sm:mt-3 sm:text-5xl">
                Book courts across Pakistan
              </h1>
              <p className="mt-2 max-w-md text-[13px] leading-snug text-white/90 sm:mt-3 sm:text-base">
                Find padel, futsal, cricket, and more — then join an open match.
              </p>
            </div>

            <form
              className="flex w-full max-w-xl flex-col gap-2.5 sm:flex-row sm:items-stretch"
              onSubmit={(e) => {
                e.preventDefault();
                searchFromHero();
              }}
            >
              <label className="sr-only" htmlFor="hero-city">
                City
              </label>
              <div className="relative flex-1">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/45" />
                <Input
                  id="hero-city"
                  value={draft.city}
                  onChange={(e) => setDraft((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Lahore, Karachi, Islamabad…"
                  className="h-11 rounded-xl border-0 bg-white pl-10 text-base text-navy shadow-panel sm:h-12"
                />
              </div>
              <Button
                type="submit"
                className="h-11 shrink-0 rounded-xl bg-brand px-6 font-bold text-white hover:bg-brand-600 sm:h-12"
              >
                Find courts
              </Button>
            </form>

            <Link
              href="/play?create=1"
              className="self-start text-[13px] font-semibold text-white/90 underline-offset-4 hover:text-white hover:underline"
            >
              Or create an open match
            </Link>
          </div>
        </HeroMedia>
      </section>

      {/* Sport filters */}
      <section className="space-y-2.5 animate-rise sm:space-y-3" style={{ animationDelay: '40ms' }}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold uppercase tracking-tight text-navy sm:text-xl">
              Sports
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">Filter venues by sport</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5 rounded-xl border-navy/15"
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
          size="sm"
        />
      </section>

      {filtersOpen ? (
        <section className="rounded-2xl border border-navy/10 bg-white p-4 shadow-panel animate-rise sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold uppercase tracking-tight text-navy">
              Refine results
            </h3>
            <button
              type="button"
              className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-navy"
              onClick={() => setFiltersOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="home-city">City</Label>
              <Input
                id="home-city"
                value={draft.city}
                onChange={(e) => setDraft((f) => ({ ...f, city: e.target.value }))}
                placeholder="Lahore"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="home-sport">Sport</Label>
              <select
                id="home-sport"
                value={draft.sport}
                onChange={(e) => setDraft((f) => ({ ...f, sport: e.target.value }))}
                className="flex h-11 w-full cursor-pointer rounded-xl border border-border bg-white px-3 text-sm text-navy"
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
              <Label htmlFor="home-min-price">Min PKR / hr</Label>
              <Input
                id="home-min-price"
                inputMode="numeric"
                value={draft.minPrice}
                onChange={(e) => setDraft((f) => ({ ...f, minPrice: e.target.value }))}
                placeholder="0"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="home-max-price">Max PKR / hr</Label>
              <Input
                id="home-max-price"
                inputMode="numeric"
                value={draft.maxPrice}
                onChange={(e) => setDraft((f) => ({ ...f, maxPrice: e.target.value }))}
                placeholder="Any"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="home-min-rating">Min rating</Label>
              <select
                id="home-min-rating"
                value={draft.minRating}
                onChange={(e) => setDraft((f) => ({ ...f, minRating: e.target.value }))}
                className="flex h-11 w-full cursor-pointer rounded-xl border border-border bg-white px-3 text-sm text-navy"
              >
                <option value="">Any</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
                <option value="4.5">4.5+</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={applyFilters}
              disabled={isFetching}
              className="rounded-xl bg-brand font-bold text-white hover:bg-brand-600"
            >
              {isFetching ? 'Loading…' : 'Apply filters'}
            </Button>
            {hasExtraFilters || draft.city !== applied.city || draft.minRating ? (
              <Button type="button" variant="outline" onClick={clearFilters} className="rounded-xl">
                Clear all
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {(applied.sport || applied.minPrice || applied.maxPrice || applied.minRating) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Active
          </span>
          {applied.sport ? (
            <button
              type="button"
              className="cursor-pointer rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand-700"
              onClick={() => {
                setDraft((f) => ({ ...f, sport: '' }));
                setApplied((f) => ({ ...f, sport: '' }));
              }}
            >
              {applied.sport} ×
            </button>
          ) : null}
          {applied.minPrice ? (
            <span className="rounded-full bg-navy/5 px-3 py-1 text-xs font-semibold text-navy">
              Min {formatPkr(Number(applied.minPrice))}
            </span>
          ) : null}
          {applied.maxPrice ? (
            <span className="rounded-full bg-navy/5 px-3 py-1 text-xs font-semibold text-navy">
              Max {formatPkr(Number(applied.maxPrice))}
            </span>
          ) : null}
          {applied.minRating ? (
            <span className="rounded-full bg-navy/5 px-3 py-1 text-xs font-semibold text-navy">
              ★ {applied.minRating}+
            </span>
          ) : null}
        </div>
      )}

      {/* Venues — mobile rail, md+ grid */}
      <section id="home-venues" className="scroll-mt-24 space-y-3 animate-rise" style={{ animationDelay: '60ms' }}>
        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-tight text-navy sm:text-xl">
            Venues in {applied.city || 'Pakistan'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isFetching ? 'Updating…' : `${venues.length} place${venues.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {error ? (
          <p className="text-sm text-red-600">
            {error instanceof Error ? error.message : 'Failed to load venues'}
          </p>
        ) : null}

        {/* Mobile: snap rail */}
        <div className="sport-rail -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isFetching && venues.length === 0
            ? [0, 1].map((i) => (
                <StadiumSkeleton
                  key={i}
                  className="w-[82%] max-w-[300px] shrink-0 snap-start"
                  lines={2}
                />
              ))
            : null}
          {venues.map((venue, index) => (
            <div key={venue.id} className="w-[82%] max-w-[300px] shrink-0 snap-start">
              <VenueCard venue={venue} index={index} compact />
            </div>
          ))}
          {!isFetching && venues.length === 0 ? (
            <div className="min-w-[82%] max-w-[300px] shrink-0 snap-start">
              <PlayerEmptyState
                title="No venues found"
                description="Try another city or clear sport filters."
                actionLabel="Clear filters"
                onAction={() => {
                  setDraft(DEFAULT_VENUE_FILTERS);
                  setApplied(DEFAULT_VENUE_FILTERS);
                }}
              />
            </div>
          ) : null}
        </div>

        {/* Tablet/desktop: density grid */}
        <div className="hidden md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {isFetching && venues.length === 0
            ? [0, 1, 2].map((i) => <StadiumSkeleton key={i} lines={2} />)
            : null}
          {venues.map((venue, index) => (
            <VenueCard key={venue.id} venue={venue} index={index} />
          ))}
          {!isFetching && venues.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3">
              <PlayerEmptyState
                title="No venues for these filters"
                description="Try another city or sport, or clear filters to browse all venues."
                actionLabel="Clear filters"
                onAction={() => {
                  setDraft(DEFAULT_VENUE_FILTERS);
                  setApplied(DEFAULT_VENUE_FILTERS);
                }}
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* Categories */}
      <section className="animate-rise" style={{ animationDelay: '80ms' }}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <MotionPress>
            <Link href="/events" className={CATEGORY_CARD}>
              <span
                className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand/30 blur-2xl"
                aria-hidden
              />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-md sm:h-16 sm:w-16">
                <Trophy className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.75} />
              </span>
              <span className="relative text-center font-display text-sm font-bold uppercase tracking-tight text-white sm:text-base">
                Tournaments
              </span>
              <span className="relative text-center text-[11px] font-medium text-white/70 sm:text-xs">
                Compete &amp; win
              </span>
            </Link>
          </MotionPress>

          <MotionPress>
            <Link href="/play" className={CATEGORY_CARD}>
              <span
                className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand/35 blur-2xl"
                aria-hidden
              />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-md sm:h-16 sm:w-16">
                <Swords className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.75} />
              </span>
              <span className="relative text-center font-display text-sm font-bold uppercase tracking-tight text-white sm:text-base">
                Match &amp; Play
              </span>
              <span className="relative text-center text-[11px] font-medium text-white/70 sm:text-xs">
                Find a game
              </span>
            </Link>
          </MotionPress>
        </div>
      </section>

      {/* Promo — below fold */}
      <AmbientPromo className="animate-rise px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-100">
              Open matches
            </p>
            <p className="mt-1 font-display text-lg font-bold uppercase tracking-tight text-white sm:text-xl">
              Join a match near you
            </p>
            <p className="mt-1 text-sm text-white/70">Fill a spot and climb the ranks this week.</p>
          </div>
          <Link
            href="/play"
            className="inline-flex h-10 w-fit cursor-pointer items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            Browse matches
          </Link>
        </div>
      </AmbientPromo>

      {/* Stats — below fold */}
      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Venues', value: venues.length },
          { label: 'Open matches', value: matches.length },
          { label: 'Tournaments', value: tournaments.length },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-white px-3 py-3 text-center shadow-panel sm:px-4"
          >
            <p className="font-display text-xl font-bold uppercase tracking-tight text-navy sm:text-2xl">
              <CountUp value={stat.value} />
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      {/* Upcoming matches */}
      <section className="space-y-3 animate-rise" style={{ animationDelay: '100ms' }}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold uppercase tracking-tight text-navy sm:text-xl">
            Upcoming Matches
          </h2>
          <Link href="/play" className="text-sm font-semibold text-brand">
            View all
          </Link>
        </div>
        {matches.length === 0 ? (
          <PlayerEmptyState
            icon={Swords}
            title="No matches yet"
            description="Create an open match to find players near you."
            actionHref="/play?create=1"
            actionLabel="Create match"
          />
        ) : (
          <div className="space-y-3">
            {matches.map((m, index) => {
              const spotsLeft = Math.max(0, m.maxPlayers - m.joinedCount);
              const when = formatMatchWhen(m.scheduledAt);
              const price =
                m.pricePerPlayer != null && m.pricePerPlayer > 0
                  ? formatPkr(m.pricePerPlayer)
                  : 'Free';
              return (
                <MotionReveal key={m.id} index={index}>
                  <MotionPress>
                    <Link
                      href={`/play/${m.id}`}
                      className="flex items-stretch gap-3 overflow-hidden rounded-2xl bg-white shadow-panel"
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
                        <div className="flex flex-wrap gap-1">
                          <span className="w-fit rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                            {m.matchType === 'COMPETITIVE' ? 'Challenge' : 'Open Match'}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {genderLabel(m.genderPreference)}
                          </Badge>
                        </div>
                        <p className="font-bold text-navy">
                          {m.sport.name} · {formatLabel(m.format, m.customFormat)}
                        </p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{m.title}</p>
                        <p className="text-[11px] font-medium text-navy/80">
                          Host {m.host.name}
                          {m.host.phone ? ` · ${m.host.phone}` : ''}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-brand" />
                            {matchVenueLine(m)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-brand" />
                            {when}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3 text-brand" />
                            {skillBandLabel(m.skillMin, m.skillMax)} · {spotsLeft} spots
                          </span>
                          <span className="font-semibold text-navy">{price}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-center gap-2 px-3 py-3">
                        <span className="text-xs font-bold text-navy">
                          {m.joinedCount}/{m.maxPlayers}
                        </span>
                        <span className="inline-flex h-9 items-center rounded-xl bg-brand px-3 text-xs font-bold text-white">
                          View & join
                        </span>
                      </div>
                    </Link>
                  </MotionPress>
                </MotionReveal>
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
            <Link href="/events" className="text-sm font-semibold text-brand">
              View all
            </Link>
          </div>
        </div>
        {tournaments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-navy/15 bg-white/70 px-4 py-6 text-sm text-muted-foreground">
            No venue tournaments in {applied.city} yet.
          </p>
        ) : (
          <div className="sport-rail -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {tournaments.map((t, index) => {
              const cover = resolveSportCover(t.sport?.name ?? 'All', t.sport?.iconUrl);
              return (
                <MotionReveal key={t.id} index={index} className="w-[200px] shrink-0 sm:w-[220px]">
                  <Link
                    href={`/events/${t.id}`}
                    className="block overflow-hidden rounded-2xl bg-white shadow-panel"
                  >
                    <div className="relative h-28">
                      <Image src={cover} alt="" fill sizes="220px" className="object-cover" />
                      <span className="absolute left-2 top-2 rounded-md bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                        Venue
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
                </MotionReveal>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
