'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { OpenMatchDto, PlayerSearchHitDto } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/play" className="text-sm text-brand hover:underline">
        ← Back to Play
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-1">
            <Badge>{match.visibility}</Badge>
            <Badge variant="secondary">{match.matchType}</Badge>
            <Badge variant="secondary">{match.format}</Badge>
            <Badge variant="outline">{match.status}</Badge>
          </div>
          <CardTitle>{match.title}</CardTitle>
          <CardDescription>
            {match.sport.name} · Host {match.host.name} · {match.joinedCount}/{match.maxPlayers} · Skill{' '}
            {match.skillMin}–{match.skillMax}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {match.notes ? <p className="text-sm text-muted-foreground">{match.notes}</p> : null}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-navy">Players</h3>
            <ul className="space-y-1 text-sm">
              {match.players.map((p) => (
                <li key={p.id} className="flex justify-between rounded-md bg-muted/50 px-3 py-2">
                  <span>
                    {p.name} {p.side ? `· ${p.side}` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.skillLevel ?? '—'} · {p.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {!alreadyIn && match.status === 'OPEN' ? (
            <Button onClick={() => void join()} disabled={busy}>
              Join open match
            </Button>
          ) : null}

          {isHost ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label>Add player (search)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Name, email, or phone"
                  value={inviteQ}
                  onChange={(e) => setInviteQ(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={() => void searchPlayers()}>
                  Find
                </Button>
              </div>
              <ul className="space-y-1">
                {hits.map((h) => (
                  <li key={h.userId} className="flex items-center justify-between text-sm">
                    <span>
                      {h.name} · {h.skillLevel ?? '—'}
                    </span>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void invite(h.userId)}>
                      Invite
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {match.result ? (
            <div className="rounded-lg bg-brand/10 px-3 py-2 text-sm">
              Final: {match.result.homeScore}–{match.result.awayScore}
              {match.result.winnerSide ? ` · ${match.result.winnerSide}` : ''}
            </div>
          ) : alreadyIn ? (
            <form className="space-y-3 rounded-lg border border-border p-3" onSubmit={reportScore}>
              <h3 className="text-sm font-semibold">Upload match score</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Home</Label>
                  <Input value={homeScore} onChange={(e) => setHomeScore(e.target.value)} type="number" />
                </div>
                <div className="space-y-1">
                  <Label>Away</Label>
                  <Input value={awayScore} onChange={(e) => setAwayScore(e.target.value)} type="number" />
                </div>
              </div>
              <Button type="submit" disabled={busy}>
                Save result
              </Button>
            </form>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-brand">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
