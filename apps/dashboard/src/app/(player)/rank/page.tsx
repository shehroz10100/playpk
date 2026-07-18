'use client';

import { useEffect, useState } from 'react';
import type { PerformanceLeaderboardEntryDto, PlayerProfileDto } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RankPage() {
  const [rows, setRows] = useState<PerformanceLeaderboardEntryDto[]>([]);
  const [me, setMe] = useState<PlayerProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Performance ranking</h1>
        <p className="text-sm text-muted-foreground">
          Live padel-style leaderboard from casual + competitive open-match results (W/L + points).
        </p>
      </div>

      {me ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your record</CardTitle>
            <CardDescription>
              {me.skillLevel}
              {me.primarySportName ? ` · ${me.primarySportName}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            <div>
              <div className="text-2xl font-semibold text-navy">{me.points}</div>
              <div className="text-xs text-muted-foreground">Points</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-navy">
                {me.wins}–{me.losses}
              </div>
              <div className="text-xs text-muted-foreground">Win–Loss</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-navy">{me.matchesPlayed}</div>
              <div className="text-xs text-muted-foreground">Matches</div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top players</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Player</th>
                  <th className="py-2 pr-2">Skill</th>
                  <th className="py-2 pr-2">W–L</th>
                  <th className="py-2 pr-2">Pts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.userId} className="border-b border-border/60">
                    <td className="py-2.5 pr-2 font-medium">{i + 1}</td>
                    <td className="py-2.5 pr-2">
                      <div className="font-medium text-navy">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.primarySportName ?? 'Multi-sport'} · {r.matchesPlayed} played
                      </div>
                    </td>
                    <td className="py-2.5 pr-2">
                      <Badge variant="secondary">{r.skillLevel}</Badge>
                    </td>
                    <td className="py-2.5 pr-2">
                      {r.wins}–{r.losses}
                    </td>
                    <td className="py-2.5 pr-2 font-semibold">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? (
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
