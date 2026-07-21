'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PerformanceLeaderboardEntryDto, PlayerProfileDto } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { AmbientPromo } from '@/components/ambient-gradient';
import { CountUp } from '@/components/motion/count-up';
import { MotionReveal } from '@/components/motion/motion-reveal';
import { RankUpGlow } from '@/components/motion/rank-up-glow';
import { StadiumSkeleton } from '@/components/motion/stadium-skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RankPage() {
  const [rows, setRows] = useState<PerformanceLeaderboardEntryDto[]>([]);
  const [me, setMe] = useState<PlayerProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [board, profile] = await Promise.all([
          api<PerformanceLeaderboardEntryDto[]>('/api/social/leaderboard'),
          api<PlayerProfileDto>('/api/social/profile/me'),
        ]);
        setRows(board.data);
        setMe(profile.data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load ranking');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const myRankIndex = useMemo(() => {
    if (!me) return -1;
    return rows.findIndex((r) => r.userId === me.userId);
  }, [me, rows]);

  return (
    <div className="space-y-6">
      <AmbientPromo className="p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Scoreboard</p>
        <h1 className="font-display mt-2 text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
          Performance ranking
        </h1>
        <p className="mt-2 max-w-lg text-sm text-white/75">
          Live leaderboard from casual + competitive open-match results (W/L + points).
        </p>
      </AmbientPromo>

      {loading ? <StadiumSkeleton lines={4} /> : null}

      {me ? (
        <MotionReveal>
          <Card className="rounded-2xl border-0 shadow-panel">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base font-bold uppercase tracking-tight">
                Your record
              </CardTitle>
              <CardDescription>
                {me.skillLevel}
                {me.primarySportName ? ` · ${me.primarySportName}` : ''}
                {myRankIndex >= 0 ? ` · Rank #${myRankIndex + 1}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6 text-sm">
              <div>
                <div className="font-display text-3xl font-bold tabular-nums text-navy">
                  <CountUp value={me.points} />
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Points
                </div>
              </div>
              <div>
                <div className="font-display text-3xl font-bold tabular-nums text-navy">
                  <CountUp value={me.wins} />–<CountUp value={me.losses} />
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Win–Loss
                </div>
              </div>
              <div>
                <div className="font-display text-3xl font-bold tabular-nums text-navy">
                  <CountUp value={me.matchesPlayed} />
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Matches
                </div>
              </div>
            </CardContent>
          </Card>
        </MotionReveal>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card className="rounded-2xl border-0 shadow-panel">
        <CardHeader>
          <CardTitle className="font-display text-lg font-bold uppercase tracking-tight">
            Top players
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-2 font-semibold">#</th>
                  <th className="py-2 pr-2 font-semibold">Player</th>
                  <th className="py-2 pr-2 font-semibold">Skill</th>
                  <th className="py-2 pr-2 font-semibold">W–L</th>
                  <th className="py-2 pr-2 font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isMe = me?.userId === r.userId;
                  return (
                    <tr key={r.userId} className="border-b border-border/60">
                      <td className="py-2.5 pr-2" colSpan={5}>
                        <RankUpGlow active={isMe} className="px-2 py-1">
                          <div className="grid grid-cols-[2rem_1fr_auto_auto_auto] items-center gap-2 sm:grid-cols-[2.5rem_1fr_5rem_4rem_3.5rem]">
                            <span className="font-display font-bold tabular-nums text-navy">
                              {i + 1}
                            </span>
                            <span>
                              <span className="block font-semibold text-navy">
                                {r.name}
                                {isMe ? (
                                  <span className="ml-2 rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#B45309]">
                                    You
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {r.primarySportName ?? 'Multi-sport'} · {r.matchesPlayed} played
                              </span>
                            </span>
                            <Badge variant="secondary">{r.skillLevel}</Badge>
                            <span className="tabular-nums">
                              {r.wins}–{r.losses}
                            </span>
                            <span className="font-display font-bold tabular-nums text-navy">
                              <CountUp value={r.points} durationMs={500} />
                            </span>
                          </div>
                        </RankUpGlow>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && rows.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No ranked players yet — play an open match and upload a score.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
