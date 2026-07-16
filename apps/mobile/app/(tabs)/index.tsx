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
  const [filters, setFilters] = useState({
    city: 'Lahore',
    sport: '',
    minPrice: '',
    maxPrice: '',
    minRating: '',
  });
  const [sports, setSports] = useState<SportDto[]>([]);
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (active?: typeof filters) => {
    setLoading(true);
    setError(null);
    try {
      const storedCity = (await getCity()) ?? 'Lahore';
      const current = active ?? filters;
      const city = current.city.trim() || storedCity;
      if (!current.city.trim()) {
        setFilters((f) => ({ ...f, city: storedCity }));
      }

      const query = new URLSearchParams({ city, pageSize: '30' });
      if (current.sport) query.set('sport', current.sport);
      if (current.minPrice.trim()) query.set('minPrice', current.minPrice);
      if (current.maxPrice.trim()) query.set('maxPrice', current.maxPrice);
      if (current.minRating.trim()) query.set('minRating', current.minRating);

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
  }, [filters]);

  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  useEffect(() => {
    void (async () => {
      const storedCity = (await getCity()) ?? 'Lahore';
      setFilters((f) => ({ ...f, city: f.city || storedCity }));
    })();
  }, []);

  function clearFilters() {
    const cleared = {
      city: filters.city,
      sport: '',
      minPrice: '',
      maxPrice: '',
      minRating: '',
    };
    setFilters(cleared);
    void load(cleared);
  }

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Near you</Text>
        <Text style={styles.city}>{filters.city}</Text>
        <Muted>Filter by sport, city, price, and rating.</Muted>
      </View>

      <SportFilterRail
        sports={sports}
        selected={filters.sport}
        onSelect={(sport) => setFilters((f) => ({ ...f, sport }))}
        featuredOnly={false}
        showAll
      />

      <Card style={{ marginHorizontal: 16, marginBottom: 8 }}>
        <Muted>City</Muted>
        <Input
          value={filters.city}
          onChangeText={(city) => setFilters((f) => ({ ...f, city }))}
          placeholder="Lahore"
        />
        <View style={{ height: 8 }} />
        <Muted>Price per hour (PKR)</Muted>
        <View style={styles.filterRow}>
          <Input
            placeholder="Min"
            keyboardType="number-pad"
            value={filters.minPrice}
            onChangeText={(minPrice) => setFilters((f) => ({ ...f, minPrice }))}
            style={styles.filterInput}
          />
          <Input
            placeholder="Max"
            keyboardType="number-pad"
            value={filters.maxPrice}
            onChangeText={(maxPrice) => setFilters((f) => ({ ...f, maxPrice }))}
            style={styles.filterInput}
          />
        </View>
        <View style={{ height: 8 }} />
        <Muted>Min rating (1–5)</Muted>
        <Input
          placeholder="e.g. 4.0"
          keyboardType="decimal-pad"
          value={filters.minRating}
          onChangeText={(minRating) => setFilters((f) => ({ ...f, minRating }))}
        />
        <View style={{ height: 8 }} />
        <View style={styles.actions}>
          <Button label="Apply filters" onPress={() => void load(filters)} loading={loading} />
          <Button label="Clear" variant="outline" onPress={clearFilters} />
        </View>
      </Card>

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
  filterRow: { flexDirection: 'row', gap: 8 },
  filterInput: { flex: 1, marginBottom: 0 },
  actions: { flexDirection: 'row', gap: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  venueName: { fontSize: 17, fontWeight: '700', color: colors.navy, marginBottom: 4 },
  error: { color: colors.danger, paddingHorizontal: 16, marginTop: 12 },
});
