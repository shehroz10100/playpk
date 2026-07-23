'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  MapPin,
  Phone,
  Plus,
  Share2,
  Users,
  Wallet,
} from 'lucide-react';
import { BOOKING_ADVANCE_PKR, type OpenMatchDto } from '@playpk/shared-types';
import { resolveSportCover } from '@playpk/shared-types';
import { HeroMedia } from '@/components/media/hero-media';
import { StadiumSkeleton } from '@/components/motion/stadium-skeleton';
import { PlayerEmptyState } from '@/components/player-empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { fetchVenueDetail, type CatalogVenueDetail } from '@/lib/catalog';
import { googleMapsEmbedUrl, googleMapsUrl } from '@/lib/google-maps';
import {
  formatMatchWhen,
  genderLabel,
  isUpcomingOpenMatch,
  skillBandLabel,
} from '@/lib/match-details';
import { formatLabel } from '@/lib/match-formats';
import { resolveVenuePreviewClip } from '@/lib/media-assets';
import { cn, formatPkr } from '@/lib/utils';
import { resolveVenueCover } from '@/lib/venue-cover';

type VenueTab = 'home' | 'book' | 'matches';

type Slot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED' | 'MAINTENANCE';
  price: number;
};

type Availability = {
  court: {
    id: string;
    name: string;
    pricePerHour: number;
    indoor: boolean;
    hasAC: boolean;
    sport: { name: string };
    branch: { id: string; name: string; city: string };
  };
  slots: Slot[];
};

type DayChip = { iso: string; weekday: string; dayNum: string; month: string; label: string };

type VenueSport = { key: string; id?: string; name: string; iconUrl?: string | null };

const DURATIONS = [30, 60, 90, 120] as const;

function nextSevenDays(): DayChip[] {
  const days: DayChip[] = [];
  const now = new Date();
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    days.push({
      iso: d.toISOString().slice(0, 10),
      weekday: weekdays[d.getUTCDay()],
      dayNum: String(d.getUTCDate()),
      month: months[d.getUTCMonth()],
      label: `${months[d.getUTCMonth()]} ${d.getUTCDate()} ${weekdays[d.getUTCDay()]}`,
    });
  }
  return days;
}

function toIsoDate(value: string): string {
  return value.slice(0, 10);
}

function slotMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + (em || 0) - (sh * 60 + (sm || 0));
}

function uniqueSports(venue: CatalogVenueDetail): VenueSport[] {
  const map = new Map<string, VenueSport>();
  for (const c of venue.courts) {
    const key = c.sport.id || c.sport.name;
    if (!map.has(key)) {
      map.set(key, {
        key,
        id: c.sport.id,
        name: c.sport.name,
        iconUrl: c.sport.iconUrl,
      });
    }
  }
  for (const s of venue.sports ?? []) {
    const key = s.id || s.name;
    if (!map.has(key)) {
      map.set(key, { key, id: s.id, name: s.name, iconUrl: s.iconUrl });
    }
  }
  return [...map.values()];
}

export default function VenueDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const days = useMemo(() => nextSevenDays(), []);

  const [venue, setVenue] = useState<CatalogVenueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<VenueTab>('home');
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const [sportSheetOpen, setSportSheetOpen] = useState(false);

  const [bookSportKey, setBookSportKey] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(days[0]?.iso ?? '');
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(60);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [matches, setMatches] = useState<OpenMatchDto[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchVenueDetail(params.id)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setError('Venue not found');
          return;
        }
        setVenue(data);
        const sports = uniqueSports(data);
        const first = sports[0]?.key ?? null;
        setSportFilter(first);
        setBookSportKey(first);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const sports = useMemo(() => (venue ? uniqueSports(venue) : []), [venue]);

  const bookCourt = useMemo(() => {
    if (!venue || !bookSportKey) return null;
    return (
      venue.courts.find((c) => (c.sport.id || c.sport.name) === bookSportKey) ??
      venue.courts[0] ??
      null
    );
  }, [venue, bookSportKey]);

  const loadSlots = useCallback(async () => {
    if (!bookCourt) {
      setAvailability(null);
      return;
    }
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const { data: res } = await api<Availability>(
        `/api/slots/court/${bookCourt.id}/availability?days=7`,
        { auth: false },
      );
      const normalized = {
        ...res,
        slots: res.slots.map((s) => ({ ...s, date: toIsoDate(String(s.date)) })),
      };
      setAvailability(normalized);
      setSelectedSlot(null);
      const lengths = normalized.slots
        .filter((s) => s.status === 'AVAILABLE')
        .map((s) => slotMinutes(s.startTime, s.endTime));
      const preferred = ([60, 90, 30, 120] as const).find((d) => lengths.includes(d));
      if (preferred) setDuration(preferred);
      setSelectedDate((current) => {
        if (normalized.slots.some((s) => s.date === current && s.status === 'AVAILABLE')) {
          return current;
        }
        const first = days.find((d) =>
          normalized.slots.some((s) => s.date === d.iso && s.status === 'AVAILABLE'),
        );
        return first?.iso ?? current;
      });
    } catch (err) {
      setSlotsError(err instanceof Error ? err.message : 'Failed to load slots');
      setAvailability(null);
    } finally {
      setSlotsLoading(false);
    }
  }, [bookCourt, days]);

  useEffect(() => {
    if (tab !== 'book') return;
    void loadSlots();
  }, [tab, loadSlots]);

  useEffect(() => {
    if (tab !== 'matches' || !venue) return;
    let cancelled = false;
    setMatchesLoading(true);
    api<OpenMatchDto[]>(`/api/social/matches?branchId=${encodeURIComponent(venue.id)}`)
      .then(({ data }) => {
        if (cancelled) return;
        setMatches(data.filter(isUpcomingOpenMatch));
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      })
      .finally(() => {
        if (!cancelled) setMatchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, venue]);

  const daySlots = useMemo(() => {
    const list = (availability?.slots ?? [])
      .filter((s) => s.date === selectedDate)
      .filter((s) => slotMinutes(s.startTime, s.endTime) === duration)
      .filter((s) => (availableOnly ? s.status === 'AVAILABLE' : true))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return list;
  }, [availability, selectedDate, duration, availableOnly]);

  const mapsHref = venue
    ? googleMapsUrl({
        address: venue.address,
        city: venue.city,
        latitude: venue.latitude,
        longitude: venue.longitude,
      })
    : '#';
  const mapsEmbed = venue
    ? googleMapsEmbedUrl({
        address: venue.address,
        city: venue.city,
        latitude: venue.latitude,
        longitude: venue.longitude,
      })
    : '';

  async function shareVenue() {
    if (!venue) return;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({ title: venue.name, text: `${venue.name} · ${venue.city}`, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* user cancelled */
    }
  }

  function continueBooking(slot: Slot) {
    if (!availability) return;
    const q = new URLSearchParams({
      slotId: slot.id,
      courtName: availability.court.name,
      branchName: availability.court.branch.name,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      price: String(BOOKING_ADVANCE_PKR),
      rate: String(slot.price),
    });
    router.push(`/book/confirm?${q.toString()}`);
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!venue) return <StadiumSkeleton className="mt-2" lines={5} />;

  const cover = resolveVenueCover(venue);
  const tour = resolveVenuePreviewClip(cover);
  const filteredSports =
    sportFilter == null ? sports : sports.filter((s) => s.key === sportFilter);

  return (
    <div className="relative pb-28 sm:pb-10">
      {/* Hero — full-bleed, tall enough for mobile */}
      <section className="-mx-4 w-[calc(100%+2rem)] overflow-hidden sm:-mx-6 sm:w-[calc(100%+3rem)]">
        <HeroMedia
          clip={tour}
          autoPlay
          minClassName="aspect-[4/3] min-h-[260px] w-full sm:aspect-[16/9] sm:min-h-[320px]"
        >
          <div className="flex h-full min-h-[260px] flex-col justify-between p-4 sm:min-h-[320px] sm:p-6">
            <div className="flex items-center justify-between">
              <Link
                href="/discover"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-navy/55 text-white backdrop-blur hover:bg-navy/70"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={() => void shareVenue()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-navy/55 text-white backdrop-blur hover:bg-navy/70"
                aria-label="Share venue"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {sports.map((s) => {
                const active = sportFilter === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSportFilter(s.key)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold backdrop-blur transition',
                      active
                        ? 'border-white bg-white text-navy'
                        : 'border-white/30 bg-navy/40 text-white hover:bg-navy/55',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveSportCover(s.name)}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = resolveSportCover('All');
                      }}
                    />
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        </HeroMedia>
      </section>

      {/* Identity card */}
      <section className="relative z-[1] -mt-5 rounded-t-3xl bg-white px-4 pb-3 pt-5 shadow-[0_-8px_24px_rgba(11,31,58,0.08)] sm:px-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
              {venue.name}
            </h1>
            {venue.discountPercent != null && venue.discountPercent > 0 ? (
              <p className="mt-2 inline-flex items-center rounded-md bg-brand px-2.5 py-1 text-xs font-bold text-white">
                {venue.discountPercent}% OFF
                {venue.sportDiscounts?.[0]?.label
                  ? ` · ${venue.sportDiscounts[0].label}`
                  : ' on selected sports'}
              </p>
            ) : null}
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <MapPin className="h-4 w-4 text-brand" />
              {venue.city}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {venue.address} · {venue.operatingHoursStart}–{venue.operatingHoursEnd}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand hover:bg-brand/20"
              aria-label="Open in Google Maps"
            >
              <MapPin className="h-5 w-5" />
            </a>
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand hover:bg-brand/20"
              aria-label="Get directions"
              title="Get directions / call venue from Maps"
            >
              <Phone className="h-5 w-5" />
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex border-b border-border">
          {(
            [
              ['home', 'Home'],
              ['book', 'Book'],
              ['matches', 'Open Matches'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 pb-3 text-sm font-bold transition',
                tab === id
                  ? 'border-b-2 border-navy text-navy'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-navy',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* HOME */}
      {tab === 'home' ? (
        <section className="mt-5 space-y-6 px-1">
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-tight text-navy">
              Club information
            </h2>
            <div className="mt-3 rounded-2xl bg-white p-4 shadow-panel">
              <p className="text-xs font-bold uppercase tracking-wide text-brand">
                {venue.company.name}
              </p>
              {venue.company.description?.trim() ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-navy/85">
                  {venue.company.description}
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  This club has not added company information yet.
                </p>
              )}
            </div>
            <ul className="mt-3 space-y-2">
              {(filteredSports.length ? filteredSports : sports).map((s) => (
                <li
                  key={s.key}
                  className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-panel"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveSportCover(s.name, s.iconUrl)}
                    alt=""
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                  <span className="font-semibold text-navy">{s.name}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-tight text-navy">
              Location
            </h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted shadow-panel">
              <iframe
                title={`${venue.name} map`}
                src={mapsEmbed}
                className="h-56 w-full border-0 sm:h-72"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex text-sm font-semibold text-brand hover:underline"
            >
              Open in Google Maps →
            </a>
          </div>

          <Button
            className="h-12 w-full rounded-xl bg-brand font-bold text-white hover:bg-brand-600"
            onClick={() => {
              setTab('book');
              setSportSheetOpen(true);
            }}
          >
            Book a court
          </Button>
        </section>
      ) : null}

      {/* BOOK */}
      {tab === 'book' ? (
        <section className="mt-5 space-y-5 px-1">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold uppercase tracking-tight text-navy">
                Sport
              </h2>
              <button
                type="button"
                onClick={() => setSportSheetOpen(true)}
                className="text-xs font-bold text-brand hover:underline"
              >
                Change
              </button>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {sports.map((s) => {
                const active = bookSportKey === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setBookSportKey(s.key);
                      setSelectedSlot(null);
                    }}
                    className={cn(
                      'flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center transition',
                      active
                        ? 'border-navy bg-navy text-white'
                        : 'border-border bg-white text-navy hover:border-navy/30',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveSportCover(s.name, s.iconUrl)}
                      alt=""
                      className="h-10 w-10 rounded-xl object-cover"
                    />
                    <span className="text-xs font-bold">{s.name}</span>
                  </button>
                );
              })}
            </div>
            {bookCourt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Court · {bookCourt.name} · from {formatPkr(bookCourt.pricePerHour)}/hr
                {bookCourt.discountPercent
                  ? ` · ${bookCourt.discountPercent}% off`
                  : ''}{' '}
                · advance {formatPkr(BOOKING_ADVANCE_PKR)}
              </p>
            ) : null}
          </div>

          <div>
            <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-tight text-navy">
              Date
            </h2>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {days.map((day) => {
                const active = day.iso === selectedDate;
                const count = (availability?.slots ?? []).filter(
                  (s) =>
                    s.date === day.iso &&
                    s.status === 'AVAILABLE' &&
                    slotMinutes(s.startTime, s.endTime) === duration,
                ).length;
                return (
                  <button
                    key={day.iso}
                    type="button"
                    onClick={() => {
                      setSelectedDate(day.iso);
                      setSelectedSlot(null);
                    }}
                    className={cn(
                      'flex min-w-[4.75rem] shrink-0 flex-col items-center rounded-xl border px-3 py-2.5 transition',
                      active
                        ? 'border-navy bg-navy text-white'
                        : 'border-border bg-white text-navy hover:border-navy/30',
                    )}
                  >
                    <span className={cn('text-[10px] font-bold uppercase', !active && 'text-muted-foreground')}>
                      {day.weekday}
                    </span>
                    <span className="text-lg font-extrabold leading-none">
                      {day.month} {day.dayNum}
                    </span>
                    <span className={cn('mt-1 text-[10px]', active ? 'text-white/90' : 'text-muted-foreground')}>
                      {count > 0 ? `${count} open` : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="mb-2 inline-flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-tight text-navy">
              <Clock className="h-4 w-4 text-brand" />
              Duration
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DURATIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setDuration(mins);
                    setSelectedSlot(null);
                  }}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-sm font-bold transition',
                    duration === mins
                      ? 'border-navy bg-navy text-white'
                      : 'border-border bg-white text-navy hover:border-navy/30',
                  )}
                >
                  {mins} Minutes
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="inline-flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-tight text-navy">
                <Clock className="h-4 w-4 text-brand" />
                Slots
              </h2>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                  className="rounded border-border"
                />
                Show available only
              </label>
            </div>

            {slotsLoading ? (
              <p className="text-sm text-muted-foreground">Loading slots…</p>
            ) : slotsError ? (
              <p className="text-sm text-red-600">{slotsError}</p>
            ) : daySlots.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-white px-4 py-6 text-sm text-muted-foreground">
                No slots are currently available. Please select a different time, duration, or sport.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {daySlots.map((slot) => {
                  const active = selectedSlot?.id === slot.id;
                  const open = slot.status === 'AVAILABLE';
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={!open}
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        'rounded-xl border px-3 py-3 text-left transition',
                        !open && 'cursor-not-allowed opacity-45',
                        active
                          ? 'border-brand bg-brand/10 text-navy'
                          : 'border-border bg-white text-navy hover:border-brand/40',
                      )}
                    >
                      <p className="text-sm font-bold">
                        {slot.startTime}–{slot.endTime}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {open ? formatPkr(slot.price) : slot.status}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedSlot ? (
            <div className="fixed inset-x-0 bottom-[5.25rem] z-40 border-t border-border bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <Button
                className="h-12 w-full rounded-xl bg-brand font-bold text-white hover:bg-brand-600"
                onClick={() => continueBooking(selectedSlot)}
              >
                Continue · {formatPkr(selectedSlot.price)}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* OPEN MATCHES */}
      {tab === 'matches' ? (
        <section className="mt-5 space-y-3 px-1">
          {matchesLoading ? (
            <p className="text-sm text-muted-foreground">Loading matches…</p>
          ) : matches.length === 0 ? (
            <PlayerEmptyState
              icon={Users}
              title="No open matches here"
              description="Be the first to host a match at this venue."
              actionHref="/play?create=1"
              actionLabel="Create match"
            />
          ) : (
            matches.map((m) => {
              const spotsLeft = Math.max(0, m.maxPlayers - m.joinedCount);
              const price =
                m.pricePerPlayer != null && m.pricePerPlayer > 0
                  ? `${formatPkr(m.pricePerPlayer)}/player`
                  : 'Free';
              return (
                <Link
                  key={m.id}
                  href={`/play/${m.id}`}
                  className="block overflow-hidden rounded-2xl bg-white shadow-panel transition hover:-translate-y-0.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                    <Badge variant="success" className="text-[10px]">
                      {skillBandLabel(m.skillMin, m.skillMax)}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                      <Calendar className="h-3 w-3 text-brand" />
                      {formatMatchWhen(m.scheduledAt)}
                    </span>
                    <Badge
                      variant={m.status === 'OPEN' ? 'success' : 'muted'}
                      className="text-[10px]"
                    >
                      {m.status}
                    </Badge>
                  </div>
                  <div className="space-y-3 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-navy">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Host {m.host.name}
                          {m.host.phone ? ` · ${m.host.phone}` : ''}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {genderLabel(m.genderPreference)} · {formatLabel(m.format)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: Math.min(4, m.maxPlayers) }).map((_, i) => {
                        const player = m.players.filter((p) => p.status === 'JOINED')[i];
                        return (
                          <div
                            key={i}
                            className="flex flex-col items-center rounded-xl bg-[#EEF3F0] px-1 py-2 text-center"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">
                              {player ? player.name.slice(0, 1).toUpperCase() : '?'}
                            </span>
                            <span className="mt-1 line-clamp-1 text-[10px] font-semibold text-navy">
                              {player?.name ?? 'Open'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-brand" />
                        {venue.name}, {venue.city}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="h-3 w-3 text-brand" />
                        {price}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3 text-brand" />
                        {spotsLeft} spots left
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}

          <Link
            href="/play?create=1"
            className="fixed bottom-[6.5rem] right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white shadow-lg hover:bg-brand sm:bottom-8 sm:right-8"
            aria-label="Create open match"
          >
            <Plus className="h-6 w-6" />
          </Link>
        </section>
      ) : null}

      {/* Sport picker sheet */}
      {sportSheetOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-navy/45"
            aria-label="Close"
            onClick={() => setSportSheetOpen(false)}
          />
          <div className="relative z-[1] max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
            <h3 className="font-display text-center text-xl font-extrabold text-navy">
              Which sport do you want to play?
            </h3>
            <ul className="mt-4 space-y-2">
              {sports.map((s) => {
                const selected = bookSportKey === s.key;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setBookSportKey(s.key);
                        setSportFilter(s.key);
                        setSportSheetOpen(false);
                        setTab('book');
                        setSelectedSlot(null);
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition',
                        selected
                          ? 'border-brand bg-brand/5'
                          : 'border-border bg-white hover:border-brand/40',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveSportCover(s.name, s.iconUrl)}
                        alt=""
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                      <span className="flex-1 font-bold text-navy">{s.name}</span>
                      {selected ? <Check className="h-5 w-5 text-brand" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
