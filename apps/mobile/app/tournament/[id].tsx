import type {
  LeaderboardEntryDto,
  TeamDto,
  TournamentDetailDto,
  TournamentStandingDto,
} from '@playpk/shared-types';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '../../src/lib/api';
import { Badge, Button, Card, Muted, Screen } from '../../src/components/ui';
import { colors, formatPkr } from '../../src/lib/theme';

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tournament, setTournament] = useState<TournamentDetailDto | null>(null);
  const [standings, setStandings] = useState<TournamentStandingDto[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryDto[]>([]);
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const t = await api<TournamentDetailDto>(`/api/tournaments/${id}`, { auth: false });
    setTournament(t.data);
    const [s, lb] = await Promise.all([
      api<TournamentStandingDto[]>(`/api/tournaments/${id}/standings`, { auth: false }),
      api<LeaderboardEntryDto[]>(`/api/leaderboard?branchId=${t.data.branchId}`, {
        auth: false,
      }),
    ]);
    setStandings(s.data);
    setLeaderboard(lb.data);
    try {
      const myTeams = await api<TeamDto[]>('/api/teams/me');
      setTeams(myTeams.data);
    } catch {
      setTeams([]);
    }
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [id]);

  async function register() {
    setBusy(true);
    try {
      await api(`/api/tournaments/${id}/register`, {
        method: 'POST',
        body: JSON.stringify(selectedTeamId ? { teamId: selectedTeamId } : {}),
      });
      Alert.alert('Registered', 'Entry fee charged via mock payment.');
      await load();
    } catch (err) {
      Alert.alert('Registration failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Screen>
        <Text style={{ color: colors.danger }}>{error}</Text>
      </Screen>
    );
  }
  if (!tournament) {
    return (
      <Screen>
        <ActivityIndicator color={colors.brand} />
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.title}>{tournament.name}</Text>
        <Muted>
          {tournament.sport?.name} · {tournament.branch?.name} · {tournament.format}
        </Muted>
        <View style={styles.row}>
          <Badge label={tournament.status} />
          <Badge label={`${formatPkr(tournament.entryFee)} entry`} tone="navy" />
          <Badge label={`${tournament.registrations.length} registered`} tone="muted" />
        </View>
        {tournament.description ? <Muted>{tournament.description}</Muted> : null}

        {tournament.status === 'OPEN' ? (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.section}>Register</Text>
            <Muted>Optional: enter with a team you’re on.</Muted>
            <View style={styles.row}>
              <Button
                label="Solo"
                variant={!selectedTeamId ? 'primary' : 'outline'}
                onPress={() => setSelectedTeamId('')}
              />
              {teams.map((t) => (
                <View key={t.id} style={{ marginLeft: 8 }}>
                  <Button
                    label={t.name}
                    variant={selectedTeamId === t.id ? 'primary' : 'outline'}
                    onPress={() => setSelectedTeamId(t.id)}
                  />
                </View>
              ))}
            </View>
            <View style={{ marginTop: 12 }}>
              <Button label="Pay & register" onPress={register} loading={busy} />
            </View>
            <View style={{ marginTop: 8 }}>
              <Button label="Manage teams" variant="outline" onPress={() => router.push('/teams')} />
            </View>
          </Card>
        ) : null}

        <Text style={styles.section}>Bracket / matches</Text>
        {(tournament.matches ?? []).length === 0 ? (
          <Muted>Fixtures not generated yet.</Muted>
        ) : (
          tournament.matches.map((m) => (
            <Card key={m.id}>
              <Text style={styles.match}>
                R{m.round} · {m.home?.label ?? 'TBD'} vs {m.away?.label ?? 'TBD'}
              </Text>
              <Muted>
                {m.status}
                {m.status === 'COMPLETED'
                  ? ` · ${m.homeScore}-${m.awayScore}${m.winner ? ` · Winner ${m.winner.label}` : ''}`
                  : ''}
              </Muted>
            </Card>
          ))
        )}

        <Text style={styles.section}>Standings</Text>
        {standings.length === 0 ? (
          <Muted>No results yet.</Muted>
        ) : (
          standings.map((row, i) => (
            <Card key={row.registrationId}>
              <Text style={styles.match}>
                #{i + 1} {row.label}
              </Text>
              <Muted>
                W{row.wins} L{row.losses} · {row.points} pts
              </Muted>
            </Card>
          ))
        )}

        <Text style={styles.section}>Branch leaderboard</Text>
        {leaderboard.slice(0, 10).map((row, i) => (
          <Card key={row.userId}>
            <Text style={styles.match}>
              #{i + 1} {row.name}
            </Text>
            <Muted>
              {row.wins} wins · {row.points} pts · {row.sports.join(', ')}
            </Muted>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.navy },
  section: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' },
  match: { fontWeight: '700', color: colors.navy, marginBottom: 2 },
});
