'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type {
  AuthUser,
  TeamDto,
  TournamentDetailDto,
  TournamentStandingDto,
} from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type PayMethod = 'mock' | 'wallet' | 'jazzcash' | 'easypaisa' | 'card';
type EntryMode = 'solo' | 'existing' | 'new';

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [tournament, setTournament] = useState<TournamentDetailDto | null>(null);
  const [standings, setStandings] = useState<TournamentStandingDto[]>([]);
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode>('solo');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [teammates, setTeammates] = useState('');
  const [method, setMethod] = useState<PayMethod>('mock');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const methods = useMemo<PayMethod[]>(
    () => ['mock', 'wallet', 'jazzcash', 'easypaisa', 'card'],
    [],
  );

  async function load() {
    const t = await api<TournamentDetailDto>(`/api/tournaments/${id}`, { auth: false });
    setTournament(t.data);
    const s = await api<TournamentStandingDto[]>(`/api/tournaments/${id}/standings`, {
      auth: false,
    });
    setStandings(s.data);
    try {
      const [myTeams, profile] = await Promise.all([
        api<TeamDto[]>('/api/teams/me'),
        api<AuthUser>('/api/auth/me'),
      ]);
      setTeams(myTeams.data);
      setMe(profile.data);
      if (!playerName) setPlayerName(profile.data.name ?? '');
      if (!playerId) setPlayerId(profile.data.email ?? profile.data.phone ?? '');
    } catch {
      setTeams([]);
    }
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    if (!tournament) return;
    setBusy(true);
    setMessage(null);
    setError(null);

    const fee = Number(tournament.entryFee);
    if (method === 'wallet' && me?.walletBalance != null && me.walletBalance < fee) {
      setError('Insufficient wallet balance for the entry fee.');
      setBusy(false);
      return;
    }
    if (entryMode === 'existing' && !selectedTeamId) {
      setError('Pick an existing team, or switch to Solo / New team.');
      setBusy(false);
      return;
    }
    if (entryMode === 'new' && teamName.trim().length < 2) {
      setError('Enter a team name (at least 2 characters).');
      setBusy(false);
      return;
    }
    if (!playerName.trim()) {
      setError('Player name is required.');
      setBusy(false);
      return;
    }

    const teammateContacts = teammates
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const { data } = await api<{ id: string; paidAmount: number; teamId: string | null }>(
        `/api/tournaments/${id}/register`,
        {
          method: 'POST',
          body: JSON.stringify({
            paymentMethod: method,
            playerName: playerName.trim(),
            ...(entryMode === 'existing' ? { teamId: selectedTeamId } : {}),
            ...(entryMode === 'new'
              ? { teamName: teamName.trim(), teammateContacts }
              : entryMode === 'existing' && teammateContacts.length
                ? { teammateContacts }
                : {}),
          }),
        },
      );
      setMessage(
        `Registered · paid ${formatPkr(data.paidAmount)} · registration ${data.id}${
          data.teamId ? ` · team ${data.teamId}` : ' · solo'
        }`,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !tournament) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!tournament) {
    return <p className="text-sm text-muted-foreground">Loading tournament…</p>;
  }

  const alreadyIn = tournament.registrations.some((r) => r.userId === me?.id);
  const fee = Number(tournament.entryFee);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-28">
      <Link href="/events" className="text-sm font-medium text-brand hover:underline">
        ← All events
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-navy">{tournament.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tournament.sport?.name} · {tournament.branch?.name} · {tournament.format}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="success">{tournament.status}</Badge>
          <Badge>{formatPkr(fee)} entry</Badge>
          <Badge variant="muted">{tournament.registrations.length} registered</Badge>
        </div>
        {tournament.description ? (
          <p className="mt-3 text-sm text-navy/80">{tournament.description}</p>
        ) : null}
      </div>

      {tournament.status === 'OPEN' && !alreadyIn ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Register & pay</CardTitle>
            <CardDescription>
              Same payment options as court booking. Choose Solo, an existing team, or create a new
              team and invite players by email/phone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onRegister}>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['solo', 'Solo'],
                    ['existing', 'Existing team'],
                    ['new', 'New team'],
                  ] as const
                ).map(([mode, label]) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant={entryMode === mode ? 'default' : 'outline'}
                    onClick={() => setEntryMode(mode)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="playerName">Player name</Label>
                  <Input
                    id="playerName"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Your name on the roster"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="playerId">Player ID (email / phone)</Label>
                  <Input
                    id="playerId"
                    value={playerId}
                    onChange={(e) => setPlayerId(e.target.value)}
                    placeholder="email or phone"
                  />
                </div>
              </div>

              {entryMode === 'existing' ? (
                <div className="space-y-2">
                  <Label>Your teams</Label>
                  {teams.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No teams yet — switch to New team or Solo.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {teams.map((t) => (
                        <Button
                          key={t.id}
                          type="button"
                          size="sm"
                          variant={selectedTeamId === t.id ? 'default' : 'outline'}
                          onClick={() => setSelectedTeamId(t.id)}
                        >
                          {t.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {entryMode === 'new' ? (
                <div className="space-y-2">
                  <Label htmlFor="teamName">Team name</Label>
                  <Input
                    id="teamName"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. DHA Smashers"
                    required={entryMode === 'new'}
                  />
                </div>
              ) : null}

              {entryMode !== 'solo' ? (
                <div className="space-y-2">
                  <Label htmlFor="teammates">Teammate emails / phones (optional)</Label>
                  <textarea
                    id="teammates"
                    className="min-h-[88px] w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                    value={teammates}
                    onChange={(e) => setTeammates(e.target.value)}
                    placeholder={'one per line, e.g.\nfriend@playpk.demo\n+923001234567'}
                  />
                  <p className="text-xs text-muted-foreground">
                    Invites are sent to existing PlayPK accounts when email/phone matches.
                  </p>
                </div>
              ) : null}

              <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Entry fee due now</span>
                  <span className="text-lg font-semibold text-navy">{formatPkr(fee)}</span>
                </div>
                {me?.walletBalance != null ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Wallet: {formatPkr(me.walletBalance)}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Payment method</Label>
                <div className="flex flex-wrap gap-2">
                  {methods.map((m) => (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={method === m ? 'default' : 'outline'}
                      onClick={() => setMethod(m)}
                    >
                      {m}
                    </Button>
                  ))}
                </div>
              </div>

              {message ? <p className="text-sm text-brand">{message}</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <Button className="w-full" type="submit" disabled={busy}>
                {busy
                  ? 'Processing…'
                  : fee > 0
                    ? `Pay ${formatPkr(fee)} & register`
                    : 'Register for free'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {alreadyIn ? (
        <p className="rounded-md border border-brand/30 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          You’re already registered for this event.
        </p>
      ) : null}

      {tournament.status !== 'OPEN' && !alreadyIn ? (
        <p className="text-sm text-muted-foreground">Registration is closed for this event.</p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-navy">Registered players</h2>
        {tournament.registrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No registrations yet.</p>
        ) : (
          tournament.registrations.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium text-navy">{r.user?.name ?? 'Player'}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.team?.name ? `Team · ${r.team.name}` : 'Solo'} · {r.paymentStatus}
                  </p>
                </div>
                <code className="text-[10px] text-muted-foreground">{r.id}</code>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-navy">Bracket / matches</h2>
        {(tournament.matches ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Fixtures not generated yet.</p>
        ) : (
          tournament.matches.map((m) => (
            <Card key={m.id}>
              <CardContent className="space-y-1 py-4 text-sm">
                <p className="font-medium text-navy">
                  R{m.round} · {m.home?.label ?? 'TBD'} vs {m.away?.label ?? 'TBD'}
                </p>
                <p className="text-muted-foreground">
                  {m.status}
                  {m.status === 'COMPLETED'
                    ? ` · ${m.homeScore}-${m.awayScore}${m.winner ? ` · Winner ${m.winner.label}` : ''}`
                    : ''}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-navy">Standings</h2>
        {standings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No results yet.</p>
        ) : (
          standings.map((row) => (
            <Card key={row.registrationId}>
              <CardContent className="flex justify-between py-3 text-sm">
                <span className="font-medium text-navy">{row.label}</span>
                <span className="text-muted-foreground">
                  {row.wins}W · {row.losses}L · {row.points} pts
                </span>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
