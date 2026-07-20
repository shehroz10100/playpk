'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  MatchFormat,
  OpenMatchDto,
  PlayerProfileDto,
  SkillLevel,
  SportDto,
} from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import {
  defaultFormatForSport,
  formatLabel,
  formatOptionsForSport,
} from '@/lib/match-formats';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SKILLS: SkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO'];

export default function PlayPage() {
  const router = useRouter();
  const search = useSearchParams();
  const createFormRef = useRef<HTMLFormElement>(null);
  const [profile, setProfile] = useState<PlayerProfileDto | null>(null);
  const [matches, setMatches] = useState<OpenMatchDto[]>([]);
  const [sports, setSports] = useState<SportDto[]>([]);
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
  const [createSportId, setCreateSportId] = useState('');
  const [city, setCity] = useState('Lahore');

  const selectedSport = sports.find((s) => s.id === createSportId);
  const formatOptions = formatOptionsForSport(selectedSport?.name);

  const load = useCallback(async () => {
    try {
      const [p, m, s] = await Promise.all([
        api<PlayerProfileDto>('/api/social/profile/me'),
        api<OpenMatchDto[]>('/api/social/matches?city=Lahore'),
        api<SportDto[]>('/api/sports'),
      ]);
      setProfile(p.data);
      setMatches(m.data);
      setSports(s.data);
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
      const { data } = await api<OpenMatchDto>('/api/social/matches', {
        method: 'POST',
        body: JSON.stringify({
          title,
          sportId: createSportId,
          visibility,
          matchType,
          format,
          city,
          skillMin: profile?.skillLevel ?? 'BEGINNER',
          skillMax: 'PRO',
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
      <div className="mx-auto max-w-lg space-y-4 animate-rise">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Play hub</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-navy">Skill setup</h1>
        </div>
        <Card className="rounded-2xl border-0 shadow-panel">
          <CardHeader>
            <CardTitle>Tell us how you play</CardTitle>
            <CardDescription>
              Quick questionnaire so we can match you with players at your level.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitOnboarding}>
              <div className="space-y-2">
                <Label>Primary sport</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
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
                <Input value={years} onChange={(e) => setYears(e.target.value)} type="number" min={0} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={playsWeekly} onChange={(e) => setPlaysWeekly(e.target.checked)} />
                I play at least weekly
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={competes} onChange={(e) => setCompetes(e.target.checked)} />
                I play competitive matches / tournaments
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" disabled={busy} className="w-full">
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Community</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-navy">Open matches</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Public or private · Friendly or Competitive · Singles or Doubles
          </p>
        </div>
        {profile ? (
          <div className="rounded-2xl bg-white px-4 py-3 text-xs shadow-panel">
            <div className="font-semibold text-navy">{profile.name}</div>
            <div className="text-muted-foreground">
              {profile.skillLevel} · {profile.wins}W–{profile.losses}L · {profile.points} pts
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card className="rounded-2xl border-0 shadow-panel">
        <CardHeader>
          <CardTitle className="text-lg">Create match</CardTitle>
          <CardDescription>Host an open match and fill remaining spots by skill.</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={createFormRef} className="grid gap-3 sm:grid-cols-2" onSubmit={createMatch}>
            <div className="space-y-2 sm:col-span-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Sport</Label>
              <select
                className="flex h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={createSportId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setCreateSportId(nextId);
                  const sport = sports.find((s) => s.id === nextId);
                  setFormat(defaultFormatForSport(sport?.name));
                  if (sport && sport.name.toLowerCase() === 'cricket') {
                    setTitle((t) => (t.toLowerCase().includes('padel') ? 'Open cricket match' : t));
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
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <select
                className="flex h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
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
                className="flex h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={matchType}
                onChange={(e) => setMatchType(e.target.value as 'FRIENDLY' | 'COMPETITIVE')}
              >
                <option value="FRIENDLY">Friendly</option>
                <option value="COMPETITIVE">Competitive</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <select
                className="flex h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
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
                {selectedSport?.name?.toLowerCase() === 'cricket'
                  ? 'Cricket sides: 8, 10, or 14 players (PlayPro-style).'
                  : 'Singles or doubles for racket sports.'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy} className="rounded-xl">
                {busy ? 'Creating…' : 'Create open match'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/my-tournaments"
          className="inline-flex h-10 items-center rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-brand"
        >
          My tournaments
        </Link>
        <Link
          href="/events"
          className="inline-flex h-10 items-center rounded-xl border border-border bg-white px-4 text-sm font-semibold text-navy hover:border-brand/40"
        >
          Browse events
        </Link>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold text-navy">Matches near your level</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open matches yet — create one above.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {matches.map((m) => (
              <Link key={m.id} href={`/play/${m.id}`}>
                <Card className="h-full rounded-2xl border-0 shadow-panel transition hover:-translate-y-0.5">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary">{m.visibility}</Badge>
                      <Badge variant="secondary">{m.matchType}</Badge>
                      <Badge variant="secondary">{formatLabel(m.format)}</Badge>
                    </div>
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    <CardDescription>
                      {m.sport.name} · {m.city ?? 'Any city'} · {m.joinedCount}/{m.maxPlayers} players
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Host {m.host.name} · Skill {m.skillMin}–{m.skillMax} · {m.status}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Skill bands: {SKILLS.join(' · ')}
      </p>
    </div>
  );
}
