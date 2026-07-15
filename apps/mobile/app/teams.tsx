import type { SportDto, TeamDto } from '@playpk/shared-types';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from '../src/lib/api';
import { Badge, Button, Card, Input, Muted, Screen, Title } from '../src/components/ui';
import { colors } from '../src/lib/theme';

type Invite = {
  id: string;
  team: { id: string; name: string; sport?: { name: string } | null; captain: { name: string } };
  invitedBy: { name: string };
};

export default function TeamsScreen() {
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [sports, setSports] = useState<SportDto[]>([]);
  const [name, setName] = useState('');
  const [sportId, setSportId] = useState('');
  const [inviteTarget, setInviteTarget] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [t, i, s] = await Promise.all([
        api<TeamDto[]>('/api/teams/me'),
        api<Invite[]>('/api/teams/invites/me'),
        api<SportDto[]>('/api/sports', { auth: false }),
      ]);
      setTeams(t.data);
      setInvites(i.data);
      setSports(s.data);
      if (!sportId && s.data[0]) setSportId(s.data[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams');
    }
  }, [sportId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function createTeam() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api('/api/teams', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), sportId: sportId || undefined }),
      });
      setName('');
      await load();
    } catch (err) {
      Alert.alert('Create failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function invite(teamId: string) {
    const raw = (inviteTarget[teamId] ?? '').trim();
    if (!raw) {
      Alert.alert('Invite', 'Enter email or phone');
      return;
    }
    const body = raw.includes('@') ? { email: raw } : { phone: raw };
    setBusy(true);
    try {
      await api(`/api/teams/${teamId}/invites`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      Alert.alert('Invite sent', 'Friend will see it under team invites.');
      setInviteTarget((prev) => ({ ...prev, [teamId]: '' }));
      await load();
    } catch (err) {
      Alert.alert('Invite failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function respond(inviteId: string, accept: boolean) {
    setBusy(true);
    try {
      await api(`/api/teams/invites/${inviteId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ accept }),
      });
      await load();
    } catch (err) {
      Alert.alert('Failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Teams</Title>
      <Muted>Create a squad and invite friends by email or phone.</Muted>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card style={{ marginTop: 16 }}>
        <Text style={styles.section}>Create team</Text>
        <Input placeholder="Team name" value={name} onChangeText={setName} />
        <View style={styles.row}>
          {sports.slice(0, 6).map((s) => (
            <Pressable key={s.id} onPress={() => setSportId(s.id)}>
              <Badge label={s.name} tone={sportId === s.id ? 'brand' : 'muted'} />
            </Pressable>
          ))}
        </View>
        <View style={{ marginTop: 10 }}>
          <Button label="Create" onPress={createTeam} loading={busy} />
        </View>
      </Card>

      {invites.length > 0 ? (
        <Card>
          <Text style={styles.section}>Pending invites</Text>
          {invites.map((inv) => (
            <View key={inv.id} style={styles.invite}>
              <Text style={styles.teamName}>{inv.team.name}</Text>
              <Muted>
                From {inv.invitedBy.name} · Captain {inv.team.captain.name}
              </Muted>
              <View style={styles.row}>
                <Button label="Accept" onPress={() => respond(inv.id, true)} loading={busy} />
                <View style={{ width: 8 }} />
                <Button
                  label="Decline"
                  variant="outline"
                  onPress={() => respond(inv.id, false)}
                  loading={busy}
                />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <FlatList
        data={teams}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<Text style={styles.section}>My teams</Text>}
        ListEmptyComponent={<Muted>No teams yet.</Muted>}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.teamName}>{item.name}</Text>
            <Muted>
              {item.sport?.name ?? 'Any sport'} · {item.members.length} members · Captain{' '}
              {item.captain?.name}
            </Muted>
            <View style={styles.row}>
              {item.members.map((m) => (
                <Badge key={m.id} label={`${m.user.name}`} tone="muted" />
              ))}
            </View>
            <Input
              placeholder="Invite email or phone"
              value={inviteTarget[item.id] ?? ''}
              onChangeText={(v) => setInviteTarget((prev) => ({ ...prev, [item.id]: v }))}
              style={{ marginTop: 10 }}
            />
            <View style={{ marginTop: 8 }}>
              <Button label="Send invite" variant="outline" onPress={() => invite(item.id)} loading={busy} />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontWeight: '700', color: colors.navy, marginBottom: 8, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  teamName: { fontWeight: '800', color: colors.navy, marginBottom: 4 },
  invite: { marginBottom: 12 },
  error: { color: colors.danger, marginTop: 8 },
});
