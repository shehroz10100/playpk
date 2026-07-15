import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AuthUser } from '@playpk/shared-types';
import { api, ApiError } from '../../src/lib/api';
import { Badge, Button, Card, Muted, Screen, Title } from '../../src/components/ui';
import { colors, formatPkr } from '../../src/lib/theme';

type PayMethod = 'mock' | 'wallet' | 'jazzcash' | 'easypaisa' | 'card';

/**
 * Booking confirmation + payment (mock provider or wallet debit).
 */
export default function ConfirmBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    slotId: string;
    courtName: string;
    branchName: string;
    date: string;
    startTime: string;
    endTime: string;
    price: string;
  }>();
  const [method, setMethod] = useState<PayMethod>('mock');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const price = Number(params.price ?? 0);

  useEffect(() => {
    api<AuthUser>('/api/auth/me')
      .then(({ data }) => setWalletBalance(data.walletBalance))
      .catch(() => setWalletBalance(null));
  }, []);

  async function payAndBook() {
    if (method === 'wallet' && walletBalance != null && walletBalance < price) {
      Alert.alert('Insufficient wallet', 'Top up from Profile, then try again.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api<{ id: string }>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          slotId: params.slotId,
          paymentMethod: method,
        }),
      });
      router.replace(`/booking/ticket/${data.id}`);
    } catch (err) {
      Alert.alert('Booking failed', err instanceof ApiError ? err.message : 'Try another slot');
    } finally {
      setLoading(false);
    }
  }

  const methods: PayMethod[] = ['mock', 'wallet', 'jazzcash', 'easypaisa', 'card'];

  return (
    <Screen>
      <Title>Confirm & pay</Title>
      <Muted>Choose mock payment or deduct from your PlayPK wallet.</Muted>

      <Card style={{ marginTop: 16 }}>
        <Text style={styles.label}>Venue</Text>
        <Text style={styles.value}>{params.branchName}</Text>
        <Text style={styles.label}>Court</Text>
        <Text style={styles.value}>{params.courtName}</Text>
        <Text style={styles.label}>Slot</Text>
        <Text style={styles.value}>
          {params.date} · {params.startTime}-{params.endTime}
        </Text>
        <Text style={styles.label}>Amount</Text>
        <Text style={styles.amount}>{formatPkr(price)}</Text>
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

      <Button label="Pay & confirm booking" onPress={payAndBook} loading={loading} />
      <Text style={styles.hint}>
        Wallet debits instantly. Other methods use MockPaymentProvider.
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
