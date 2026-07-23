'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type {
  LeaderboardEntryDto,
  TournamentDetailDto,
  TournamentMatchDto,
  TournamentStandingDto,
} from '@playpk/shared-types';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TournamentManagePage() {
  const params = useParams<{ branchId: string; tournamentId: string }>();
  const { branchId, tournamentId } = params;
  const [tournament, setTournament] = useState<TournamentDetailDto | null>(null);
  const [standings, setStandings] = useState<TournamentStandingDto[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({});

  async function load() {
    const [t, s, lb] = await Promise.all([
      api<TournamentDetailDto>(`/api/tournaments/${tournamentId}`),
      api<TournamentStandingDto[]>(`/api/tournaments/${tournamentId}/standings`),
      api<LeaderboardEntryDto[]>(
        `/api/leaderboard?branchId=${branchId}`,
      ),
    ]);
    setTournament(t.data);
    setStandings(s.data);
    setLeaderboard(lb.data);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, branchId]);

  const rounds = useMemo(() => {
    const map = new Map<number, TournamentMatchDto[]>();
    for (const m of tournament?.matches ?? []) {
      const list = map.get(m.round) ?? [];
      list.push(m);
      map.set(m.round, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [tournament]);

  async function generateFixtures() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tournaments/${tournamentId}/fixtures/generate`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fixture generation failed');
    } finally {
      setBusy(false);
    }
  }

  async function closeRegistration() {
    setBusy(true);
    try {
      await api(`/api/tournaments/${tournamentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CLOSED' }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function cancelTournament() {
    if (
      !window.confirm(
        'Cancel this tournament? Players will no longer be able to register, and it will be hidden from public listings.',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tournaments/${tournamentId}/cancel`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveResult(matchId: string) {
    const s = scores[matchId];
    if (!s) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tournaments/matches/${matchId}/result`, {
        method: 'POST',
        body: JSON.stringify({
          homeScore: Number(s.home),
          awayScore: Number(s.away),
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Result failed');
    } finally {
      setBusy(false);
    }
  }

  if (!tournament) {
    return <p className="text-sm text-muted-foreground">{error ?? 'Loading tournament…'}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/branches/${branchId}/tournaments`} className="text-xs text-brand hover:underline">
            ← All tournaments
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-navy">{tournament.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tournament.sport?.name} · {tournament.format} · {formatPkr(tournament.entryFee)} entry
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={tournament.status === 'CANCELLED' ? 'warn' : 'success'}>
            {tournament.status}
          </Badge>
          {tournament.status === 'OPEN' ? (
            <Button variant="outline" disabled={busy} onClick={closeRegistration}>
              Close registration
            </Button>
          ) : null}
          {tournament.status !== 'CANCELLED' && tournament.status !== 'COMPLETED' ? (
            <Button variant="danger" disabled={busy} onClick={cancelTournament}>
              Cancel tournament
            </Button>
          ) : null}
          <Button
            disabled={
              busy ||
              tournament.format !== 'KNOCKOUT' ||
              tournament.status === 'CANCELLED' ||
              tournament.status === 'COMPLETED'
            }
            onClick={generateFixtures}
          >
            {busy ? 'Working…' : 'Generate knockout fixtures'}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Registrations</CardDescription>
            <CardTitle className="text-3xl">{tournament.registrations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Matches</CardDescription>
            <CardTitle className="text-3xl">{tournament.matches.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prize pool</CardDescription>
            <CardTitle className="text-3xl">{formatPkr(tournament.prizePool)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered players</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tournament.registrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one registered yet.</p>
          ) : (
            tournament.registrations.map((r) => (
              <div key={r.id} className="flex justify-between border-b border-border py-2 text-sm">
                <span className="font-medium text-navy">
                  {r.team?.name ? `${r.team.name} (${r.user.name})` : r.user.name}
                </span>
                <Badge variant={r.paymentStatus === 'PAID' ? 'success' : 'warn'}>
                  {r.paymentStatus} · {formatPkr(r.paidAmount)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fixtures & results</CardTitle>
          <CardDescription>Enter scores for scheduled knockout matches (no draws).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {rounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Generate fixtures once you have at least 2 paid registrations.
            </p>
          ) : (
            rounds.map(([round, matches]) => (
              <div key={round}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Round {round}
                </h3>
                <div className="space-y-3">
                  {matches.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-md border border-border px-4 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-navy">
                          {m.home?.label ?? 'TBD'} vs {m.away?.label ?? 'TBD'}
                        </div>
                        <Badge variant={m.status === 'COMPLETED' ? 'success' : 'muted'}>
                          {m.status}
                          {m.winner ? ` · ${m.winner.label}` : ''}
                        </Badge>
                      </div>
                      {m.status === 'COMPLETED' ? (
                        <p className="mt-2 text-muted-foreground">
                          Score {m.homeScore}–{m.awayScore}
                        </p>
                      ) : m.home && m.away ? (
                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <div>
                            <div className="mb-1 text-xs text-muted-foreground">Home</div>
                            <Input
                              className="w-20"
                              type="number"
                              min={0}
                              value={scores[m.id]?.home ?? ''}
                              onChange={(e) =>
                                setScores((prev) => ({
                                  ...prev,
                                  [m.id]: { home: e.target.value, away: prev[m.id]?.away ?? '' },
                                }))
                              }
                            />
                          </div>
                          <div>
                            <div className="mb-1 text-xs text-muted-foreground">Away</div>
                            <Input
                              className="w-20"
                              type="number"
                              min={0}
                              value={scores[m.id]?.away ?? ''}
                              onChange={(e) =>
                                setScores((prev) => ({
                                  ...prev,
                                  [m.id]: { home: prev[m.id]?.home ?? '', away: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <Button size="sm" disabled={busy} onClick={() => saveResult(m.id)}>
                            Save result
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">Waiting for both sides…</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Standings</CardTitle>
            <CardDescription>3 points per win</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Player / team</th>
                  <th className="py-2">W</th>
                  <th className="py-2">L</th>
                  <th className="py-2">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.registrationId} className="border-t border-border">
                    <td className="py-2 font-medium text-navy">{row.label}</td>
                    <td className="py-2">{row.wins}</td>
                    <td className="py-2">{row.losses}</td>
                    <td className="py-2">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branch leaderboard</CardTitle>
            <CardDescription>Across completed tournament matches at this branch</CardDescription>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">No results yet.</p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">#</th>
                    <th className="py-2">Player</th>
                    <th className="py-2">Wins</th>
                    <th className="py-2">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.slice(0, 15).map((row, i) => (
                    <tr key={row.userId} className="border-t border-border">
                      <td className="py-2">{i + 1}</td>
                      <td className="py-2 font-medium text-navy">{row.name}</td>
                      <td className="py-2">{row.wins}</td>
                      <td className="py-2">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
