'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import type { OpenMatchDto, PlayerSearchHitDto } from '@playpk/shared-types';
import { resolveSportCover } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { formatLabel } from '@/lib/match-formats';
import { MotionReveal } from '@/components/motion/motion-reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function PlayMatchPage() {
  const params = useParams<{ id: string }>();
  const matchId = params.id;
  const me = getStoredUser();
  const [match, setMatch] = useState<OpenMatchDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [homeScore, setHomeScore] = useState('6');
  const [awayScore, setAwayScore] = useState('4');
  const [inviteQ, setInviteQ] = useState('');
  const [hits, setHits] = useState<PlayerSearchHitDto[]>([]);

  const load = useCallback(async () => {
    try {
      const { data } = await api<OpenMatchDto>(`/api/social/matches/${matchId}`);
      setMatch(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load match');
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api<OpenMatchDto>(`/api/social/matches/${matchId}/join`, {
        method: 'POST',
      });
      setMatch(data);
      setMessage('Joined match');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Join failed');
    } finally {
      setBusy(false);
    }
  }

  async function searchPlayers() {
    if (inviteQ.trim().length < 2) return;
    try {
      const { data } = await api<PlayerSearchHitDto[]>(
        `/api/social/players/search?q=${encodeURIComponent(inviteQ.trim())}`,
      );
      setHits(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed');
    }
  }

  async function invite(userId: string) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api<OpenMatchDto>(`/api/social/matches/${matchId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      setMatch(data);
      setMessage('Invite sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  }

  async function reportScore(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await api<OpenMatchDto>(`/api/social/matches/${matchId}/result`, {
        method: 'POST',
        body: JSON.stringify({
          homeScore: Number(homeScore),
          awayScore: Number(awayScore),
        }),
      });
      setMatch(data);
      setMessage('Score saved · stats updated');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save score');
    } finally {
      setBusy(false);
    }
  }

  if (!match) {
    return <p className="text-sm text-muted-foreground">{error ?? 'Loading match…'}</p>;
  }

  const isHost = me?.id === match.host.id;
  const alreadyIn = match.players.some((p) => p.userId === me?.id && p.status === 'JOINED');
  const canJoin = !alreadyIn && match.status === 'OPEN';
  const spotsLeft = Math.max(0, match.maxPlayers - match.joinedCount);
  const fillPct = Math.min(100, Math.round((match.joinedCount / Math.max(1, match.maxPlayers)) * 100));

  return (
    <div className={cn('mx-auto max-w-2xl space-y-4', canJoin && 'pb-24 sm:pb-0')}>
      <Link
        href="/play"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Play
      </Link>

      <MotionReveal>
        <div className="overflow-hidden rounded-2xl bg-white shadow-panel">
          <div className="relative h-36 sm:h-44">
            <Image
              src={resolveSportCover(match.sport.name, match.sport.iconUrl)}
              alt=""
              fill
              sizes="(max-width: 672px) 100vw, 672px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/50 to-navy/20" />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <div className="flex flex-wrap gap-1">
                <span className="rounded-md bg-brand/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#C8FF3D]">
                  {match.status}
                </span>
                <Badge variant="secondary" className="border-0 bg-white/15 text-[10px] text-white">
                  {match.visibility}
                </Badge>
                <Badge variant="secondary" className="border-0 bg-white/15 text-[10px] text-white">
                  {match.matchType}
                </Badge>
                <Badge variant="secondary" className="border-0 bg-white/15 text-[10px] text-white">
                  {formatLabel(match.format)}
                </Badge>
              </div>
              <h1 className="font-display mt-2 text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
                {match.title}
              </h1>
              <p className="mt-1 text-sm text-white/75">
                {match.sport.name} · Host {match.host.name}
              </p>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1 font-semibold text-navy">
                  <Users className="h-3.5 w-3.5 text-brand" />
                  {match.joinedCount}/{match.maxPlayers} players
                </span>
                <span className="text-muted-foreground">
                  {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left · Skill {match.skillMin}–
                  {match.skillMax}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-300"
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            </div>

            {match.notes ? <p className="text-sm text-muted-foreground">{match.notes}</p> : null}

            <div>
              <h2 className="font-display mb-2 text-sm font-bold uppercase tracking-tight text-navy">
                Roster
              </h2>
              <ul className="space-y-2">
                {match.players.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-xl bg-[#EEF3F0] px-3 py-2.5"
                  >
                    <span className="text-sm font-semibold text-navy">
                      {p.name}
                      {p.side ? (
                        <span className="ml-2 text-xs font-medium text-muted-foreground">
                          {p.side}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.skillLevel ?? '—'} · {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {canJoin ? (
              <Button
                onClick={() => void join()}
                disabled={busy}
                className="hidden h-11 w-full rounded-xl bg-accent font-bold text-navy hover:bg-accent/90 sm:inline-flex"
              >
                {busy ? 'Joining…' : 'Join open match'}
              </Button>
            ) : null}

            {isHost ? (
              <div className="space-y-2 rounded-xl border border-border p-3">
                <Label>Add player (search)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Name, email, or phone"
                    value={inviteQ}
                    onChange={(e) => setInviteQ(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl"
                    onClick={() => void searchPlayers()}
                  >
                    Find
                  </Button>
                </div>
                <ul className="space-y-1">
                  {hits.map((h) => (
                    <li key={h.userId} className="flex items-center justify-between text-sm">
                      <span>
                        {h.name} · {h.skillLevel ?? '—'}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        disabled={busy}
                        onClick={() => void invite(h.userId)}
                      >
                        Invite
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {match.result ? (
              <div className="rounded-xl bg-brand/10 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">Final</p>
                <p className="font-display mt-1 text-3xl font-bold tabular-nums text-navy">
                  {match.result.homeScore}–{match.result.awayScore}
                </p>
                {match.result.winnerSide ? (
                  <p className="mt-1 text-sm text-muted-foreground">{match.result.winnerSide}</p>
                ) : null}
              </div>
            ) : alreadyIn ? (
              <form
                className="space-y-3 rounded-xl border border-border bg-white p-4"
                onSubmit={reportScore}
              >
                <h3 className="font-display text-sm font-bold uppercase tracking-tight text-navy">
                  Upload match score
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Home</Label>
                    <Input
                      value={homeScore}
                      onChange={(e) => setHomeScore(e.target.value)}
                      type="number"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Away</Label>
                    <Input
                      value={awayScore}
                      onChange={(e) => setAwayScore(e.target.value)}
                      type="number"
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={busy} className="h-11 rounded-xl bg-navy hover:bg-brand">
                  {busy ? 'Saving…' : 'Save result'}
                </Button>
              </form>
            ) : null}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {message ? <p className="text-sm font-medium text-brand">{message}</p> : null}
          </div>
        </div>
      </MotionReveal>

      {canJoin ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/95 p-3 backdrop-blur sm:hidden">
          <Button
            onClick={() => void join()}
            disabled={busy}
            className="h-12 w-full rounded-xl bg-accent font-bold text-navy hover:bg-accent/90"
          >
            {busy ? 'Joining…' : `Join · ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
