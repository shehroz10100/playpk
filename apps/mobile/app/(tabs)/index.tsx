import type { SportDto, VenueListItem } from '@playpk/shared-types';
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
import { Badge, Button, Card, Input, Muted, Screen } from '../../src/components/ui';
import { SportFilterRail } from '../../src/components/SportFilterRail';
import { colors, formatPkr } from '../../src/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const [city, setCityState] = useState('Lahore');
  const [sports, setSports] = useState<SportDto[]>([]);
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [sport, setSport] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [timeHint, setTimeHint] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const storedCity = (await getCity()) ?? 'Lahore';
      setCityState(storedCity);
      const query = new URLSearchParams({ city: storedCity, pageSize: '30' });
      if (sport) query.set('sport', sport);
      if (maxPrice) query.set('maxPrice', maxPrice);
      if (minRating) query.set('minRating', minRating);

      const [venuesRes, sportsRes] = await Promise.all([
        api<VenueListItem[]>(`/api/venues?${query.toString()}`, { auth: false }),
        api<SportDto[]>('/api/sports', { auth: false }),
      ]);
      setVenues(venuesRes.data);
      setSports(sportsRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load venues');
    } finally {
      setLoading(false);
    }
  }, [sport, maxPrice, minRating]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    void timeHint;
  }, [timeHint]);

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Near you</Text>
        <Text style={styles.city}>{city}</Text>
        <Muted>Filter by sport, budget, rating, and preferred time.</Muted>
      </View>

      <SportFilterRail
        sports={sports}
        selected={sport}
        onSelect={setSport}
        featuredOnly={false}
        showAll
      />

      <View style={styles.filterRow}>
        <Input
          placeholder="Max price / hr"
          keyboardType="number-pad"
          value={maxPrice}
          onChangeText={setMaxPrice}
          style={styles.filterInput}
        />
        <Input
          placeholder="Min rating"
          keyboardType="decimal-pad"
          value={minRating}
          onChangeText={setMinRating}
          style={styles.filterInput}
        />
        <Input
          placeholder="Time e.g. 18:00"
          value={timeHint}
          onChangeText={setTimeHint}
          style={styles.filterInput}
        />
      </View>
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <Button label="Apply filters" onPress={load} variant="secondary" />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={venues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ListEmptyComponent={<Muted>No venues found for these filters.</Muted>}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/venue/${item.id}`)}>
              <Card>
                <Text style={styles.venueName}>{item.name}</Text>
                <Muted>
                  {item.company.name} · {item.address}
                </Muted>
                <View style={styles.metaRow}>
                  <Badge
                    label={item.avgRating ? `${item.avgRating.toFixed(1)}★` : 'New'}
                    tone="navy"
                  />
                  <Badge
                    label={item.minPrice != null ? `from ${formatPkr(item.minPrice)}` : '—'}
                    tone="brand"
                  />
                  <Badge label={`${item.courtCount} courts`} tone="muted" />
                </View>
                <View style={styles.metaRow}>
                  {item.sports.slice(0, 4).map((s) => (
                    <Badge key={s.id} label={s.name} />
                  ))}
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  kicker: {
    color: colors.brand,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 11,
  },
  city: { fontSize: 26, fontWeight: '800', color: colors.navy, marginVertical: 4 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  filterInput: { flexGrow: 1, flexBasis: 110, minWidth: 100, marginBottom: 0 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  venueName: { fontSize: 17, fontWeight: '700', color: colors.navy, marginBottom: 4 },
  error: { color: colors.danger, paddingHorizontal: 16, marginTop: 12 },
});
