import type { TournamentDto } from '@playpk/shared-types';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/lib/api';
import { getCity } from '../../src/lib/auth';
import { Badge, Card, Muted, Screen, Title } from '../../src/components/ui';
import { colors, formatPkr } from '../../src/lib/theme';

export default function TournamentsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<TournamentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState('Lahore');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stored = (await getCity()) ?? 'Lahore';
      setCity(stored);
      const { data } = await api<TournamentDto[]>(
        `/api/tournaments?city=${encodeURIComponent(stored)}`,
        { auth: false },
      );
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <Title>Tournaments</Title>
      <Muted>Open events near {city}. Register with mock payment.</Muted>
      <View style={{ height: 12 }} />
      <Pressable onPress={() => router.push('/teams')}>
        <Text style={styles.link}>My teams & invites →</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 12 }}
          ListEmptyComponent={<Muted>No tournaments in this city yet.</Muted>}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/tournament/${item.id}`)}>
              <Card>
                <Text style={styles.name}>{item.name}</Text>
                <Muted>
                  {item.sport?.name} · {item.branch?.name} · {item.format}
                </Muted>
                <View style={styles.row}>
                  <Badge label={item.status} tone="brand" />
                  <Badge label={`${formatPkr(item.entryFee)} entry`} tone="navy" />
                  <Badge label={`${item.registrationCount ?? 0} joined`} tone="muted" />
                </View>
                <Muted>
                  {String(item.startDate).slice(0, 10)} → {String(item.endDate).slice(0, 10)}
                </Muted>
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.brandDark, fontWeight: '700', marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '800', color: colors.navy, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  error: { color: colors.danger, marginTop: 16 },
});
