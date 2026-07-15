import type { BookingDto, MyBookingsResponse } from '@playpk/shared-types';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '../../src/lib/api';
import { Badge, Button, Card, Muted, Screen } from '../../src/components/ui';
import { colors, formatPkr } from '../../src/lib/theme';

export default function BookingsScreen() {
  const router = useRouter();
  const [upcoming, setUpcoming] = useState<BookingDto[]>([]);
  const [past, setPast] = useState<BookingDto[]>([]);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api<MyBookingsResponse>('/api/bookings/me');
      setUpcoming(data.upcoming);
      setPast(data.past);
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not load bookings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function cancel(bookingId: string) {
    Alert.alert('Cancel booking?', 'A mock refund will be processed if payment was completed.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
            await load();
          } catch (err) {
            Alert.alert('Cancel failed', err instanceof ApiError ? err.message : 'Try again');
          }
        },
      },
    ]);
  }

  const data = tab === 'upcoming' ? upcoming : past;

  return (
    <Screen>
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab('upcoming')}
          style={[styles.tab, tab === 'upcoming' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>Upcoming</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('past')}
          style={[styles.tab, tab === 'past' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'past' && styles.tabTextActive]}>Past</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Muted>No {tab} bookings yet.</Muted>}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.title}>
                {item.slot?.court?.name ?? 'Court'} · {item.slot?.court?.sport?.name}
              </Text>
              <Muted>
                {item.slot?.court?.branch?.name} · {String(item.slot?.date).slice(0, 10)} ·{' '}
                {item.slot?.startTime}-{item.slot?.endTime}
              </Muted>
              <View style={styles.row}>
                <Badge label={item.status} tone={item.status === 'CANCELLED' ? 'danger' : 'brand'} />
                <Badge label={formatPkr(item.totalAmount)} tone="navy" />
              </View>
              <View style={styles.actions}>
                <Button
                  label="Ticket"
                  variant="outline"
                  onPress={() => router.push(`/booking/ticket/${item.id}`)}
                />
                {tab === 'upcoming' && item.status !== 'CANCELLED' ? (
                  <>
                    <View style={{ width: 8 }} />
                    <Button label="Cancel" variant="danger" onPress={() => cancel(item.id)} />
                  </>
                ) : null}
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  tabText: { color: colors.navy, fontWeight: '700' },
  tabTextActive: { color: colors.white },
  title: { fontWeight: '700', color: colors.navy, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actions: { flexDirection: 'row', marginTop: 12 },
});
