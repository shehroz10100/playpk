import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AuthUser } from '@playpk/shared-types';
import { BOOKING_ADVANCE_PKR } from '@playpk/shared-types';
import { api, ApiError } from '../../src/lib/api';
import { Badge, Button, Card, Muted, Screen, Title } from '../../src/components/ui';
import { colors, formatPkr } from '../../src/lib/theme';

type PayMethod = 'mock' | 'wallet' | 'jazzcash' | 'easypaisa' | 'card' | 'bank_transfer';

function applyPercentOff(price: number, percentOff: number): number {
  const pct = Math.min(90, Math.max(0, percentOff));
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}

/**
 * Booking confirmation + payment.
 * Advance is always Rs 1000 × slots; sport discount applies only to remaining at venue.
 */
export default function ConfirmBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    slotId?: string;
    slotIds?: string;
    courtName: string;
    branchName: string;
    date: string;
    startTime: string;
    endTime: string;
    price?: string;
    total?: string;
    times?: string;
    rates?: string;
    discountPercent?: string;
  }>();

  const slotIds = useMemo(() => {
    if (params.slotIds) {
      return params.slotIds.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return params.slotId ? [params.slotId] : [];
  }, [params.slotId, params.slotIds]);

  const slotLines = useMemo(() => {
    const times = (params.times ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const rates = (params.rates ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (times.length > 0) {
      return times.map((t, i) => ({ label: t, price: rates[i] ?? 0 }));
    }
    if (params.startTime && params.endTime) {
      return [
        {
          label: `${params.startTime}–${params.endTime}`,
          price: Number(params.price ?? params.total ?? 0),
        },
      ];
    }
    return [];
  }, [params]);

  const courtTotal =
    Number(params.total ?? 0) ||
    slotLines.reduce((sum, s) => sum + s.price, 0) ||
    Number(params.price ?? 0);
  const discountPercent = Number(params.discountPercent ?? 0) || 0;
  const discountedTotal =
    discountPercent > 0 ? applyPercentOff(courtTotal, discountPercent) : courtTotal;
  const advance = BOOKING_ADVANCE_PKR * Math.max(slotIds.length, 1);
  const remaining = Math.max(0, discountedTotal - advance);

  const [method, setMethod] = useState<PayMethod>('wallet');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<AuthUser>('/api/auth/me')
      .then(({ data }) => setWalletBalance(data.walletBalance))
      .catch(() => setWalletBalance(null));
  }, []);

  async function payAndBook() {
    if (slotIds.length === 0) {
      Alert.alert('Missing slots', 'Go back and pick times again.');
      return;
    }
    if (method === 'wallet' && walletBalance != null && walletBalance < advance) {
      Alert.alert('Insufficient wallet', 'Top up from Profile, then try again.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api<{ id: string; ids?: string[] }>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          slotIds,
          slotId: slotIds[0],
          paymentMethod: method,
        }),
      });
      const bookedId = data.ids?.[0] ?? data.id;
      router.replace(`/booking/ticket/${bookedId}`);
    } catch (err) {
      Alert.alert('Booking failed', err instanceof ApiError ? err.message : 'Try another slot');
    } finally {
      setLoading(false);
    }
  }

  const methods: PayMethod[] = ['wallet', 'bank_transfer', 'jazzcash', 'easypaisa', 'card', 'mock'];

  return (
    <Screen>
      <Title>Confirm & pay</Title>
      <Muted>
        Pay {formatPkr(BOOKING_ADVANCE_PKR)} advance per slot
        {slotIds.length > 1 ? ` (${slotIds.length} × ${formatPkr(BOOKING_ADVANCE_PKR)})` : ''}.
        Sport discounts apply to the remaining balance at the venue, not the advance.
      </Muted>

      <Card style={{ marginTop: 16 }}>
        <Text style={styles.label}>Venue</Text>
        <Text style={styles.value}>{params.branchName}</Text>
        <Text style={styles.label}>Court</Text>
        <Text style={styles.value}>{params.courtName}</Text>
        <Text style={styles.label}>Date</Text>
        <Text style={styles.value}>{params.date}</Text>
        {slotLines.length > 0 ? (
          slotLines.map((line) => (
            <View key={line.label}>
              <Text style={styles.label}>{line.label}</Text>
              <Text style={styles.value}>{formatPkr(line.price)}</Text>
            </View>
          ))
        ) : (
          <>
            <Text style={styles.label}>Slot</Text>
            <Text style={styles.value}>
              {params.startTime}-{params.endTime}
            </Text>
          </>
        )}
        {courtTotal > 0 ? (
          <>
            <Text style={styles.label}>Court total</Text>
            <Text style={styles.value}>{formatPkr(courtTotal)}</Text>
          </>
        ) : null}
        {discountPercent > 0 ? (
          <>
            <Text style={styles.label}>Online discount ({discountPercent}%)</Text>
            <Text style={styles.value}>
              −{formatPkr(Math.max(0, courtTotal - discountedTotal))}
            </Text>
            <Text style={styles.label}>After discount</Text>
            <Text style={styles.value}>{formatPkr(discountedTotal)}</Text>
          </>
        ) : null}
        <Text style={styles.label}>Advance due now</Text>
        <Text style={styles.amount}>{formatPkr(advance)}</Text>
        {remaining > 0 ? (
          <>
            <Text style={styles.label}>Pay at venue</Text>
            <Text style={styles.value}>{formatPkr(remaining)}</Text>
          </>
        ) : null}
        {walletBalance != null ? (
          <Muted>Wallet balance: {formatPkr(walletBalance)}</Muted>
        ) : null}
      </Card>

      <Text style={styles.section}>Payment method</Text>
      <View style={styles.methods}>
        {methods.map((m) => (
          <Badge key={m} label={m.toUpperCase()} tone={method === m ? 'brand' : 'muted'} />
        ))}
      </View>
      <View style={styles.methodButtons}>
        {methods.map((m) => (
          <View key={m} style={{ flex: 1, minWidth: '45%', marginBottom: 8 }}>
            <Button
              label={m}
              variant={method === m ? 'primary' : 'outline'}
              onPress={() => setMethod(m)}
            />
          </View>
        ))}
      </View>

      <Button
        label={`Pay ${formatPkr(advance)} advance & book`}
        onPress={payAndBook}
        loading={loading}
      />
      <Text style={styles.hint}>
        Wallet debits instantly. Bank / JazzCash / Easypaisa / card may require proof on web checkout.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 12, marginTop: 8 },
  value: { color: colors.navy, fontWeight: '700', fontSize: 15 },
  amount: { color: colors.brandDark, fontWeight: '800', fontSize: 24, marginTop: 4 },
  section: { marginTop: 18, marginBottom: 8, fontWeight: '700', color: colors.navy },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  methodButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  hint: { marginTop: 12, color: colors.muted, fontSize: 12 },
});
