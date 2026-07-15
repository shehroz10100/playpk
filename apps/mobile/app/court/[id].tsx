import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '../../src/lib/api';
import { Badge, Button, Card, Muted, Screen } from '../../src/components/ui';
import { colors, formatPkr } from '../../src/lib/theme';

type Slot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED' | 'MAINTENANCE';
  price: number;
};

type Availability = {
  court: {
    id: string;
    name: string;
    pricePerHour: number;
    indoor: boolean;
    hasAC: boolean;
    sport: { name: string };
    branch: { id: string; name: string; city: string };
  };
  slots: Slot[];
};

type DayChip = {
  iso: string;
  weekday: string;
  dayNum: string;
  month: string;
};

function toIsoDate(value: string | Date): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function nextSevenDays(): DayChip[] {
  const days: DayChip[] = [];
  const now = new Date();
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    days.push({
      iso: d.toISOString().slice(0, 10),
      weekday: weekdays[d.getUTCDay()],
      dayNum: String(d.getUTCDate()),
      month: months[d.getUTCMonth()],
    });
  }
  return days;
}

export default function CourtSlotsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 420;
  const days = useMemo(() => nextSevenDays(), []);
  const [selectedDate, setSelectedDate] = useState(days[0]?.iso ?? '');
  const [data, setData] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [waitlisting, setWaitlisting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api<Availability>(`/api/slots/court/${id}/availability?days=7`, { auth: false })
      .then(({ data: res }) => {
        const normalized = {
          ...res,
          slots: res.slots.map((s) => ({ ...s, date: toIsoDate(s.date) })),
        };
        setData(normalized);
        setSelectedSlot(null);
        const firstWithSlots = days.find((d) =>
          normalized.slots.some((s) => s.date === d.iso && s.status === 'AVAILABLE'),
        );
        if (firstWithSlots) setSelectedDate(firstWithSlots.iso);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, days]);

  const daySlots = (data?.slots ?? [])
    .filter((s) => toIsoDate(s.date) === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const availableCount = daySlots.filter((s) => s.status === 'AVAILABLE').length;

  async function joinWaitlist(slot: Slot) {
    setWaitlisting(true);
    try {
      const { data: res } = await api<{ position?: number; alreadyJoined?: boolean }>(
        `/api/waitlist/slots/${slot.id}`,
        { method: 'POST' },
      );
      Alert.alert(
        res.alreadyJoined ? 'Already on waitlist' : 'Joined waitlist',
        res.alreadyJoined
          ? 'We will notify you if this slot opens.'
          : `You are #${res.position ?? '?'} in line. If the booking cancels, we auto-confirm you.`,
      );
    } catch (err) {
      Alert.alert('Waitlist failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setWaitlisting(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.brand} />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <Text style={{ color: colors.danger }}>{error ?? 'Court not found'}</Text>
      </Screen>
    );
  }

  const selectedDay = days.find((d) => d.iso === selectedDate);

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={[styles.header, { paddingHorizontal: compact ? 12 : 16 }]}>
        <Text style={[styles.title, { fontSize: compact ? 20 : 22 }]}>{data.court.name}</Text>
        <Muted>
          {data.court.sport.name} · {data.court.branch.name} · from{' '}
          {formatPkr(data.court.pricePerHour)}/hr
        </Muted>
        <View style={styles.row}>
          <Badge label={data.court.indoor ? 'Indoor' : 'Outdoor'} />
          <Badge label={data.court.hasAC ? 'AC' : 'No AC'} tone="muted" />
        </View>
      </View>

      <Text style={[styles.section, { paddingHorizontal: compact ? 12 : 16 }]}>Next 7 days</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: compact ? 12 : 16,
          paddingBottom: 4,
          gap: 8,
        }}
      >
        {days.map((day) => {
          const active = day.iso === selectedDate;
          const count = (data.slots ?? []).filter(
            (s) => toIsoDate(s.date) === day.iso && s.status === 'AVAILABLE',
          ).length;
          return (
            <Pressable
              key={day.iso}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${day.weekday} ${day.dayNum} ${day.month}, ${count} slots`}
              onPress={() => {
                setSelectedDate(day.iso);
                setSelectedSlot(null);
              }}
              style={({ pressed }) => [
                styles.day,
                { minWidth: compact ? 64 : 72 },
                active && styles.dayActive,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={[styles.dayWeekday, active && styles.dayTextActive]}>{day.weekday}</Text>
              <Text style={[styles.dayNum, active && styles.dayTextActive]}>{day.dayNum}</Text>
              <Text style={[styles.dayMonth, active && styles.dayTextActive]}>{day.month}</Text>
              <Text style={[styles.dayMeta, active && styles.dayMetaActive]}>
                {count > 0 ? `${count} open` : '—'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: compact ? 12 : 16, marginBottom: 8 }}>
        <Muted>
          {selectedDay
            ? `${selectedDay.weekday} ${selectedDay.dayNum} ${selectedDay.month} · ${availableCount} available`
            : 'Pick a day'}
        </Muted>
      </View>

      <FlatList
        data={daySlots}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: compact ? 12 : 16 }}>
            <Muted>No slots for this day. Try another date or ask the venue to publish slots.</Muted>
          </View>
        }
        contentContainerStyle={{
          paddingHorizontal: compact ? 12 : 16,
          paddingBottom: 130,
        }}
        renderItem={({ item }) => {
          const available = item.status === 'AVAILABLE';
          const booked = item.status === 'BOOKED';
          const selected = selectedSlot?.id === item.id;
          return (
            <Pressable
              disabled={!available}
              onPress={() => setSelectedSlot(item)}
              style={({ pressed }) => [
                styles.slot,
                !available && !booked && styles.slotDisabled,
                selected && styles.slotSelected,
                pressed && available && { opacity: 0.92 },
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.slotTime}>
                  {item.startTime} – {item.endTime}
                </Text>
                <Muted>{formatPkr(item.price)}</Muted>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Badge
                  label={item.status}
                  tone={
                    item.status === 'AVAILABLE'
                      ? 'brand'
                      : item.status === 'BOOKED'
                        ? 'danger'
                        : 'warn'
                  }
                />
                {booked ? (
                  <Pressable onPress={() => joinWaitlist(item)} disabled={waitlisting}>
                    <Text style={styles.waitlistLink}>Join waitlist</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { left: compact ? 12 : 16, right: compact ? 12 : 16 }]}>
        <Card style={{ marginBottom: 8 }}>
          <Muted>
            {selectedSlot
              ? `${selectedDate} · ${selectedSlot.startTime}-${selectedSlot.endTime} · ${formatPkr(selectedSlot.price)}`
              : 'Tap an available time slot to continue'}
          </Muted>
        </Card>
        <Button
          label="Continue to payment"
          disabled={!selectedSlot}
          onPress={() =>
            router.push({
              pathname: '/booking/confirm',
              params: {
                slotId: selectedSlot!.id,
                courtName: data.court.name,
                branchName: data.court.branch.name,
                date: selectedDate,
                startTime: selectedSlot!.startTime,
                endTime: selectedSlot!.endTime,
                price: String(selectedSlot!.price),
              },
            })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 4 },
  title: { fontWeight: '800', color: colors.navy },
  section: { marginTop: 14, marginBottom: 8, fontWeight: '700', color: colors.navy, fontSize: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  day: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dayActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  dayWeekday: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dayNum: {
    color: colors.navy,
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 24,
    marginTop: 2,
  },
  dayMonth: {
    color: colors.navy,
    fontWeight: '600',
    fontSize: 12,
  },
  dayMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  dayTextActive: { color: colors.white },
  dayMetaActive: { color: 'rgba(255,255,255,0.9)' },
  slot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  slotSelected: { borderColor: colors.brand, backgroundColor: '#E8F8EF' },
  slotDisabled: { opacity: 0.45 },
  slotTime: { fontWeight: '700', color: colors.navy, marginBottom: 2, fontSize: 15 },
  waitlistLink: { color: colors.brandDark, fontWeight: '700', fontSize: 12 },
  footer: {
    position: 'absolute',
    bottom: 12,
  },
});
