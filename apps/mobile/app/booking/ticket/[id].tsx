import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../../../src/lib/api';
import { Badge, Button, Card, Muted, Screen, Title } from '../../../src/components/ui';
import { colors, formatPkr } from '../../../src/lib/theme';

type Booking = {
  id: string;
  status: string;
  totalAmount: number;
  paymentStatus: string;
  qrCode: string | null;
  slot?: {
    date: string;
    startTime: string;
    endTime: string;
    court?: {
      name: string;
      sport?: { name: string };
      branch?: { name: string; city: string; address?: string };
    };
  };
};

export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Booking>(`/api/bookings/${id}`)
      .then(({ data }) => setBooking(data))
      .catch((err: Error) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <Screen>
        <Text style={{ color: colors.danger }}>{error}</Text>
      </Screen>
    );
  }
  if (!booking) {
    return (
      <Screen>
        <ActivityIndicator color={colors.brand} />
      </Screen>
    );
  }

  const qrValue = booking.qrCode ?? `playpk://booking/${booking.id}`;

  return (
    <Screen>
      <Title>Digital ticket</Title>
      <Muted>Show this QR at the venue entrance.</Muted>

      <Card style={styles.ticket}>
        <View style={styles.qrWrap}>
          <QRCode value={qrValue} size={180} color={colors.navy} backgroundColor={colors.white} />
        </View>
        <Text style={styles.court}>{booking.slot?.court?.name}</Text>
        <Muted>
          {booking.slot?.court?.sport?.name} · {booking.slot?.court?.branch?.name}
        </Muted>
        <Text style={styles.slot}>
          {String(booking.slot?.date).slice(0, 10)} · {booking.slot?.startTime}-
          {booking.slot?.endTime}
        </Text>
        <View style={styles.row}>
          <Badge label={booking.status} tone="brand" />
          <Badge label={booking.paymentStatus} tone="navy" />
          <Badge label={formatPkr(booking.totalAmount)} />
        </View>
        <Muted>Ticket ID: {booking.id}</Muted>
      </Card>

      <Button label="View my bookings" variant="secondary" onPress={() => router.replace('/(tabs)/bookings')} />
      <View style={{ height: 10 }} />
      <Button label="Back to home" variant="outline" onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  ticket: { marginTop: 16, alignItems: 'center' },
  qrWrap: {
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  court: { fontSize: 18, fontWeight: '800', color: colors.navy },
  slot: { marginTop: 8, fontWeight: '700', color: colors.navy },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12, justifyContent: 'center' },
});
