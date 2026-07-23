'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SportDto, TournamentDto, VenueListItem } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { fetchSportsCatalog, fetchVenuesCatalog } from '@/lib/catalog';
import { formatPkr } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function todayPlus(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function MyTournamentsPage() {
  const router = useRouter();
  const [mine, setMine] = useState<TournamentDto[]>([]);
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [sports, setSports] = useState<SportDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('Community Cup');
  const [branchId, setBranchId] = useState('');
  const [sportId, setSportId] = useState('');
  const [format, setFormat] = useState<'KNOCKOUT' | 'LEAGUE' | 'GROUPS'>('KNOCKOUT');
  const [entryFee, setEntryFee] = useState('500');
  const [prizePool, setPrizePool] = useState('5000');
  const [startDate, setStartDate] = useState(todayPlus(7));
  const [endDate, setEndDate] = useState(todayPlus(9));
  const [maxParticipants, setMaxParticipants] = useState('16');
  const [description, setDescription] = useState('Player-hosted tournament — join and compete!');

  const load = useCallback(async () => {
    setError(null);

    const [mineResult, venueList, sportList] = await Promise.all([
      api<TournamentDto[]>('/api/tournaments/mine')
        .then((res) => ({ ok: true as const, data: res.data }))
        .catch((err) => ({
          ok: false as const,
          message: err instanceof ApiError ? err.message : 'Failed to load your tournaments',
        })),
      fetchVenuesCatalog({ city: 'Lahore', sport: '', minPrice: '', maxPrice: '', minRating: '' }),
      fetchSportsCatalog(),
    ]);

    setVenues(venueList);
    setSports(sportList);
    setBranchId((prev) => prev || venueList[0]?.id || '');
    setSportId((prev) => {
      if (prev) return prev;
      const padel = sportList.find((s) => s.name.toLowerCase() === 'padel');
      return padel?.id ?? sportList[0]?.id ?? '';
    });

    if (mineResult.ok) {
      setMine(mineResult.data);
    } else {
      setMine([]);
      setError(mineResult.message);
    }

    if (venueList.length === 0 || sportList.length === 0) {
      setError((prev) =>
        prev ??
        (venueList.length === 0
          ? 'No approved venues found. Try again in a moment.'
          : 'No sports found. Try again in a moment.'),
      );
    }
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  async function createTournament(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await api<TournamentDto>('/api/tournaments/community', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          name,
          sportId,
          format,
          entryFee: Number(entryFee) || 0,
          prizePool: Number(prizePool) || 0,
          startDate,
          endDate,
          maxParticipants: Number(maxParticipants) || undefined,
          description,
        }),
      });
      router.push(`/events/${data.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create tournament');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Host</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-navy">My tournaments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a community tournament at an approved venue — it also shows on Home &amp; Events.
          </p>
        </div>
        <Link
          href="/events"
          className="text-sm font-semibold text-brand hover:underline"
        >
          Browse all events →
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card className="rounded-2xl border-0 shadow-panel">
        <CardHeader>
          <CardTitle>Create tournament</CardTitle>
          <CardDescription>Pick a venue, set fees and dates, then invite players to register.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={createTournament}>
            <div className="space-y-2 sm:col-span-2">
              <Label>Name</Label>
              <Input className="rounded-xl" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Venue</Label>
              <select
                className="flex h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
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
              <Label>Sport</Label>
              <select
                className="flex h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={sportId}
                onChange={(e) => setSportId(e.target.value)}
                required
              >
                {sports.length === 0 ? (
                  <option value="">Loading sports…</option>
                ) : (
                  sports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <select
                className="flex h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
              >
                <option value="KNOCKOUT">Knockout</option>
                <option value="LEAGUE">League</option>
                <option value="GROUPS">Groups</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Max players</Label>
              <Input
                className="rounded-xl"
                inputMode="numeric"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Entry fee (PKR)</Label>
              <Input
                className="rounded-xl"
                inputMode="numeric"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Prize pool (PKR)</Label>
              <Input
                className="rounded-xl"
                inputMode="numeric"
                value={prizePool}
                onChange={(e) => setPrizePool(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Start</Label>
              <Input
                className="rounded-xl"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input
                className="rounded-xl"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Input
                className="rounded-xl"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy || !branchId} className="rounded-xl">
                {busy ? 'Creating…' : 'Create tournament'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-navy">Hosting &amp; registered</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven&apos;t created or joined a tournament yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((item) => (
              <Link key={item.id} href={`/events/${item.id}`}>
                <Card className="h-full rounded-2xl border-0 shadow-panel transition hover:-translate-y-0.5">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="success">{item.status}</Badge>
                      {item.isCommunity || item.hostUserId ? (
                        <Badge variant="secondary">Community</Badge>
                      ) : (
                        <Badge variant="muted">Venue event</Badge>
                      )}
                    </div>
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <CardDescription>
                      {item.sport?.name} · {item.branch?.name} · {item.format}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {formatPkr(item.entryFee)} entry · {item.registrationCount ?? 0} joined
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
