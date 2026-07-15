import type {
  AuthUser,
  LoyaltyStatusDto,
  NotificationDto,
  WalletStatusDto,
} from '@playpk/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '../../src/lib/api';
import { clearSession, getCity, getStoredUser } from '../../src/lib/auth';
import { Badge, Button, Card, Input, Muted, Screen, Title } from '../../src/components/ui';
import { colors, formatPkr } from '../../src/lib/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [city, setCityState] = useState<string>('');
  const [loyalty, setLoyalty] = useState<LoyaltyStatusDto | null>(null);
  const [wallet, setWallet] = useState<WalletStatusDto | null>(null);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [topUpAmount, setTopUpAmount] = useState('1000');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api<AuthUser>('/api/auth/me');
      setUser(data);
    } catch {
      setUser(await getStoredUser());
    }
    setCityState((await getCity()) ?? '');
    try {
      const [loy, wal, notes] = await Promise.all([
        api<LoyaltyStatusDto>('/api/loyalty/me'),
        api<WalletStatusDto>('/api/wallet/me'),
        api<NotificationDto[]>('/api/notifications/me'),
      ]);
      setLoyalty(loy.data);
      setWallet(wal.data);
      setNotifications(notes.data);
    } catch {
      /* offline / first load */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function signOut() {
    await clearSession();
    router.replace('/onboarding/login');
  }

  async function changeCity() {
    Alert.alert('Change city', 'Return to city selection?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change', onPress: () => router.push('/onboarding/city') },
    ]);
  }

  async function topUp() {
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive PKR amount');
      return;
    }
    setBusy(true);
    try {
      await api('/api/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      await refresh();
      Alert.alert('Wallet topped up', `Added ${formatPkr(amount)} (mock)`);
    } catch (err) {
      Alert.alert('Top-up failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function markNotificationsRead() {
    try {
      await api('/api/notifications/me/read-all', { method: 'POST' });
      await refresh();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Try again');
    }
  }

  return (
    <Screen>
      <Title>Profile</Title>
      <Muted>Loyalty, wallet top-up, and waitlist notifications.</Muted>

      <Card style={{ marginTop: 16 }}>
        <Text style={styles.name}>{user?.name ?? 'Player'}</Text>
        <Muted>{user?.email ?? user?.phone}</Muted>
        <View style={styles.row}>
          <Badge label={loyalty?.loyaltyTier ?? user?.loyaltyTier ?? 'BRONZE'} tone="brand" />
          <Badge label={city || 'City not set'} tone="navy" />
        </View>
      </Card>

      <Card>
        <Text style={styles.metricLabel}>Wallet balance</Text>
        <Text style={styles.metricValue}>
          {formatPkr(wallet?.walletBalance ?? user?.walletBalance ?? 0)}
        </Text>
        <View style={styles.topUpRow}>
          <Input
            value={topUpAmount}
            onChangeText={setTopUpAmount}
            keyboardType="numeric"
            placeholder="Amount PKR"
            style={{ flex: 1 }}
          />
          <View style={{ width: 8 }} />
          <Button label="Top up" onPress={topUp} loading={busy} />
        </View>
        <Muted>Mock top-up — balance can be used as payment on booking.</Muted>
      </Card>

      <Card>
        <Text style={styles.metricLabel}>Loyalty</Text>
        <Text style={styles.metricValue}>{loyalty?.loyaltyPoints ?? user?.loyaltyPoints ?? 0}</Text>
        <Muted>
          Tier {loyalty?.loyaltyTier ?? user?.loyaltyTier ?? 'BRONZE'}
          {loyalty?.nextTier
            ? ` · ${loyalty.pointsToNext} pts to ${loyalty.nextTier}`
            : ' · Max tier'}
        </Muted>
        {(loyalty?.recent ?? []).slice(0, 3).map((t) => (
          <Muted key={t.id}>
            +{t.points} · {t.reason}
          </Muted>
        ))}
      </Card>

      <Card>
        <View style={styles.notifyHeader}>
          <Text style={styles.metricLabel}>Notifications</Text>
          {notifications.some((n) => !n.readAt) ? (
            <Button label="Mark read" variant="outline" onPress={markNotificationsRead} />
          ) : null}
        </View>
        {notifications.length === 0 ? (
          <Muted>No notifications yet (waitlist promotions appear here).</Muted>
        ) : (
          <FlatList
            data={notifications.slice(0, 8)}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.note}>
                <Text style={styles.noteTitle}>{item.title}</Text>
                <Muted>{item.body}</Muted>
              </View>
            )}
          />
        )}
      </Card>

      <Button label="Change city" variant="outline" onPress={changeCity} />
      <View style={{ height: 10 }} />
      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 20, fontWeight: '800', color: colors.navy },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metricLabel: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  metricValue: { fontSize: 28, fontWeight: '800', color: colors.navy },
  topUpRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  notifyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  note: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  noteTitle: { fontWeight: '700', color: colors.navy, marginBottom: 2 },
});
