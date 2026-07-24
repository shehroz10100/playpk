'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, MapPin, Swords, Trophy, Users, Wallet } from 'lucide-react';
import type {
  MatchFormat,
  MatchGenderPreference,
  OpenMatchDto,
  PlayerProfileDto,
  SkillLevel,
  SportDto,
  VenueListItem,
} from '@playpk/shared-types';
import { resolveSportCover } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { fetchVenuesCatalog } from '@/lib/catalog';
import {
  formatMatchWhen,
  genderLabel,
  isUpcomingOpenMatch,
  matchVenueLine,
  skillBandLabel,
  toIsoFromLocalInput,
} from '@/lib/match-details';
import {
  defaultFormatForSport,
  defaultMaxPlayersForCustom,
  formatHintForSport,
  formatLabel,
  formatOptionsForSport,
} from '@/lib/match-formats';
import { formatPkr } from '@/lib/utils';
import { AmbientPromo } from '@/components/ambient-gradient';
import { MotionPress, MotionReveal } from '@/components/motion/motion-reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SKILLS: SkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO'];

function defaultLocalDateTime(hoursAhead = 24): string {
  const d = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PlayPage() {
  const router = useRouter();
  const search = useSearchParams();
  const createFormRef = useRef<HTMLFormElement>(null);
  const [profile, setProfile] = useState<PlayerProfileDto | null>(null);
  const [matches, setMatches] = useState<OpenMatchDto[]>([]);
  const [sports, setSports] = useState<SportDto[]>([]);
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [years, setYears] = useState('1');
  const [playsWeekly, setPlaysWeekly] = useState(true);
  const [competes, setCompetes] = useState(false);
  const [sportId, setSportId] = useState('');

  const [title, setTitle] = useState('Open padel hit');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [matchType, setMatchType] = useState<'FRIENDLY' | 'COMPETITIVE'>('FRIENDLY');
  const [format, setFormat] = useState<MatchFormat>('DOUBLES');
  const [customFormat, setCustomFormat] = useState('');
  const [customMaxPlayers, setCustomMaxPlayers] = useState('10');
  const [createSportId, setCreateSportId] = useState('');
  const [city, setCity] = useState('Lahore');
  const [branchId, setBranchId] = useState('');
  const [scheduledLocal, setScheduledLocal] = useState(defaultLocalDateTime());
  const [skillMin, setSkillMin] = useState<SkillLevel>('BEGINNER');
  const [skillMax, setSkillMax] = useState<SkillLevel>('PRO');
  const [genderPreference, setGenderPreference] = useState<MatchGenderPreference>('ANY');
  const [pricePerPlayer, setPricePerPlayer] = useState('500');
  const [notes, setNotes] = useState('');

  const selectedSport = sports.find((s) => s.id === createSportId);
  const formatOptions = formatOptionsForSport(selectedSport?.name);

  useEffect(() => {
    const next = defaultFormatForSport(selectedSport?.name);
    setFormat(next);
    setCustomMaxPlayers(String(defaultMaxPlayersForCustom(selectedSport?.name)));
    if (next !== 'CUSTOM') setCustomFormat('');
  }, [selectedSport?.name]);

  const load = useCallback(async () => {
    try {
      const [p, m, s, venueList] = await Promise.all([
        api<PlayerProfileDto>('/api/social/profile/me'),
        api<OpenMatchDto[]>('/api/social/matches?city=Lahore'),
        api<SportDto[]>('/api/sports'),
        fetchVenuesCatalog({ city: 'Lahore', sport: '', minPrice: '', maxPrice: '', minRating: '' }),
      ]);
      setProfile(p.data);
      setMatches(m.data.filter(isUpcomingOpenMatch));
      setSports(s.data);
      setVenues(venueList);
      setBranchId((prev) => prev || venueList[0]?.id || '');
      if (p.data.skillLevel) {
        setSkillMin((prev) => (prev === 'BEGINNER' ? p.data.skillLevel : prev));
      }
      if (s.data[0]) {
        const padel = s.data.find((x) => x.name.toLowerCase() === 'padel') ?? s.data[0];
        setCreateSportId((prev) => prev || padel.id);
        setSportId((prev) => prev || padel.id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load play hub');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (search.get('create') === '1') {
      createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [search]);

  async function submitOnboarding(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await api<PlayerProfileDto>('/api/social/profile/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          primarySportId: sportId || undefined,
          answers: {
            yearsPlaying: Number(years) || 0,
            playsWeekly,
            competes,
          },
        }),
      });
      setProfile(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Onboarding failed');
    } finally {
      setBusy(false);
    }
  }

  async function createMatch(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (format === 'CUSTOM') {
        if (!customFormat.trim()) {
          setError('Enter your custom format style');
          setBusy(false);
          return;
        }
        const players = Number(customMaxPlayers);
        if (!Number.isFinite(players) || players < 2 || players > 30) {
          setError('Custom format needs between 2 and 30 players');
          setBusy(false);
          return;
        }
      }
      const selectedVenue = venues.find((v) => v.id === branchId);
      const { data } = await api<OpenMatchDto>('/api/social/matches', {
        method: 'POST',
        body: JSON.stringify({
          title,
          sportId: createSportId,
          visibility,
          matchType,
          format,
          customFormat: format === 'CUSTOM' ? customFormat.trim() : undefined,
          maxPlayers: format === 'CUSTOM' ? Number(customMaxPlayers) : undefined,
          city: selectedVenue?.city || city,
          branchId: branchId || undefined,
          scheduledAt: toIsoFromLocalInput(scheduledLocal),
          skillMin,
          skillMax,
          genderPreference,
          pricePerPlayer: Number(pricePerPlayer) || 0,
          notes: notes.trim() || undefined,
        }),
      });
      router.push(`/play/${data.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create match');
    } finally {
      setBusy(false);
    }
  }

  if (profile && !profile.onboardingComplete) {
    return (
      <div className="mx-auto max-w-lg space-y-5 animate-rise">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Play hub</p>
          <h1 className="font-display mt-1 text-3xl font-bold uppercase tracking-tight text-navy">
            Skill setup
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick questionnaire so we can match you with players at your level.
          </p>
        </div>
        <Card className="rounded-2xl border-0 shadow-panel">
          <CardHeader>
            <CardTitle className="font-display text-lg font-bold uppercase tracking-tight">
              Tell us how you play
            </CardTitle>
            <CardDescription>Primary sport, experience, and how often you compete.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitOnboarding}>
              <div className="space-y-2">
                <Label>Primary sport</Label>
                <select
                  className="flex h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                  value={sportId}
                  onChange={(e) => setSportId(e.target.value)}
                >
                  {sports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Years playing</Label>
                <Input
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                  type="number"
                  min={0}
                  className="h-11 rounded-xl"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={playsWeekly}
                  onChange={(e) => setPlaysWeekly(e.target.checked)}
                  className="rounded border-border"
                />
                I play at least weekly
              </label>
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={competes}
                  onChange={(e) => setCompetes(e.target.checked)}
                  className="rounded border-border"
                />
                I play competitive matches / tournaments
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">
                {busy ? 'Saving…' : 'Continue to Play'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-rise">
      <AmbientPromo className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Community</p>
            <h1 className="font-display mt-2 text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
              Open matches
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/75">
              Public or private · Friendly or Competitive · Singles or Doubles
            </p>
          </div>
          <MotionPress>
            <button
              type="button"
              onClick={() =>
                createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-600"
            >
              <Swords className="h-4 w-4" />
              Create match
            </button>
          </MotionPress>
        </div>
      </AmbientPromo>

      {profile ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-panel">
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-tight text-navy">
              {profile.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {profile.skillLevel}
              {profile.primarySportName ? ` · ${profile.primarySportName}` : ''}
            </p>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="font-display text-lg font-bold tabular-nums text-navy">
                {profile.wins}–{profile.losses}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                W–L
              </p>
            </div>
            <div>
              <p className="font-display text-lg font-bold tabular-nums text-navy">{profile.points}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Pts
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-tight text-navy sm:text-xl">
            Matches near your level
          </h2>
          <Link href="/rank" className="text-xs font-semibold text-brand hover:underline">
            View rank
          </Link>
        </div>

        {matches.length === 0 ? (
          <button
            type="button"
            onClick={() =>
              createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-panel"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Swords className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-semibold text-navy">No open matches yet</span>
              <span className="text-sm text-muted-foreground">Create one below to get started</span>
            </span>
          </button>
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
                          <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                            {m.visibility === 'PUBLIC' ? 'Open' : 'Private'}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {m.matchType}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {formatLabel(m.format, m.customFormat)}
                          </Badge>
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
                          <span className="inline-flex items-center gap-1">
                            <Wallet className="h-3 w-3 text-brand" />
                            {price}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-center gap-2 px-3 py-3">
                        <span className="font-display text-sm font-bold tabular-nums text-navy">
                          {m.joinedCount}/{m.maxPlayers}
                        </span>
                        <span className="inline-flex h-9 items-center rounded-xl bg-brand px-3 text-xs font-bold text-white">
                          Join
                        </span>
                      </div>
                    </Link>
                  </MotionPress>
                </MotionReveal>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/events"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-brand"
        >
          <Trophy className="h-4 w-4" />
          Venue tournaments
        </Link>
        <Link
          href="/my-tournaments"
          className="inline-flex h-10 items-center rounded-xl border border-border bg-white px-4 text-sm font-semibold text-navy hover:border-brand/40"
        >
          My registrations
        </Link>
      </div>

      <Card className="rounded-2xl border-0 shadow-panel">
        <CardHeader>
          <CardTitle className="font-display text-lg font-bold uppercase tracking-tight">
            Create match
          </CardTitle>
          <CardDescription>Host an open match and fill remaining spots by skill.</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={createFormRef} className="grid gap-3 sm:grid-cols-2" onSubmit={createMatch}>
            <div className="space-y-2 sm:col-span-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Sport</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={createSportId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setCreateSportId(nextId);
                  const sport = sports.find((s) => s.id === nextId);
                  // format reset handled by useEffect on selectedSport?.name
                  if (sport && sport.name.toLowerCase() === 'cricket') {
                    setTitle((t) => (t.toLowerCase().includes('padel') ? 'Open cricket match' : t));
                  }
                  if (sport && sport.name.toLowerCase() === 'futsal') {
                    setTitle((t) =>
                      t.toLowerCase().includes('padel') || t.toLowerCase().includes('cricket')
                        ? 'Open futsal match'
                        : t,
                    );
                  }
                }}
              >
                {sports.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Venue</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  const venue = venues.find((v) => v.id === e.target.value);
                  if (venue) setCity(venue.city);
                }}
                required
              >
                {venues.length === 0 ? (
                  <option value="">Loading venues…</option>
                ) : (
                  venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {v.city}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Date & time</Label>
              <Input
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
                required
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Price per player (PKR)</Label>
              <Input
                inputMode="numeric"
                value={pricePerPlayer}
                onChange={(e) => setPricePerPlayer(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={genderPreference}
                onChange={(e) => setGenderPreference(e.target.value as MatchGenderPreference)}
              >
                <option value="ANY">Anyone</option>
                <option value="MEN">Men&apos;s</option>
                <option value="WOMEN">Women&apos;s</option>
                <option value="MIXED">Mixed</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Skill min</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={skillMin}
                onChange={(e) => setSkillMin(e.target.value as SkillLevel)}
              >
                {SKILLS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Skill max</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={skillMax}
                onChange={(e) => setSkillMax(e.target.value as SkillLevel)}
              >
                {SKILLS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'PUBLIC' | 'PRIVATE')}
              >
                <option value="PUBLIC">Public (open match)</option>
                <option value="PRIVATE">Private (invite only)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Match type</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={matchType}
                onChange={(e) => setMatchType(e.target.value as 'FRIENDLY' | 'COMPETITIVE')}
              >
                <option value="FRIENDLY">Friendly</option>
                <option value="COMPETITIVE">Competitive (challenge)</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Format</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={format}
                onChange={(e) => setFormat(e.target.value as MatchFormat)}
              >
                {formatOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                {formatHintForSport(selectedSport?.name)}
              </p>
              {format === 'CUSTOM' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Your format style</Label>
                    <Input
                      className="rounded-xl"
                      placeholder="e.g. 5v5, 7-a-side, King of the court"
                      value={customFormat}
                      onChange={(e) => setCustomFormat(e.target.value)}
                      required
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Players needed</Label>
                    <Input
                      className="rounded-xl"
                      inputMode="numeric"
                      value={customMaxPlayers}
                      onChange={(e) => setCustomMaxPlayers(e.target.value)}
                      required
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Court number, bring balls, contact notes…"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy || !branchId} className="h-11 rounded-xl bg-navy hover:bg-brand">
                {busy ? 'Creating…' : 'Create open match'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Skill bands: {SKILLS.join(' · ')}</p>
    </div>
  );
}
