import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '../../src/lib/api';
import { saveSession, type AuthUser } from '../../src/lib/auth';
import { Button, Input, Screen, Subtitle, Title } from '../../src/components/ui';
import { colors } from '../../src/lib/theme';

type Mode = 'email' | 'phone';

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('email');
  const [email, setEmail] = useState('player@playpk.demo');
  const [phone, setPhone] = useState('+923009876543');
  const [password, setPassword] = useState('PlayPK@player1');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  async function loginEmail() {
    setLoading(true);
    try {
      const { data } = await api<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password }),
      });
      await saveSession(data);
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Login failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp() {
    setLoading(true);
    try {
      await api('/api/auth/otp/request', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ phone }),
      });
      setOtpSent(true);
      Alert.alert('OTP sent', 'Check the API server console for the mock OTP code.');
    } catch (err) {
      Alert.alert('OTP failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    try {
      const { data } = await api<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>('/api/auth/otp/verify', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ phone, code: otp }),
      });
      await saveSession(data);
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('OTP verify failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>Welcome back</Title>
      <Subtitle>Sign in with email or phone to book courts across Pakistan.</Subtitle>

      <View style={styles.toggleRow}>
        <Button
          label="Email"
          variant={mode === 'email' ? 'primary' : 'outline'}
          onPress={() => setMode('email')}
        />
        <View style={{ width: 8 }} />
        <Button
          label="Phone / OTP"
          variant={mode === 'phone' ? 'primary' : 'outline'}
          onPress={() => setMode('phone')}
        />
      </View>

      {mode === 'email' ? (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.label}>Email</Text>
          <Input
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>Password</Text>
          <Input secureTextEntry value={password} onChangeText={setPassword} />
          <Button label="Sign in" onPress={loginEmail} loading={loading} />
        </View>
      ) : (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.label}>Phone</Text>
          <Input
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            autoCapitalize="none"
          />
          {otpSent ? (
            <>
              <Text style={styles.label}>OTP code</Text>
              <Input keyboardType="number-pad" value={otp} onChangeText={setOtp} maxLength={6} />
              <Button label="Verify & continue" onPress={verifyOtp} loading={loading} />
            </>
          ) : (
            <Button label="Send OTP" onPress={requestOtp} loading={loading} />
          )}
        </View>
      )}

      <Text style={styles.hint}>
        Demo: player@playpk.demo / PlayPK@player1 · player2@playpk.demo / PlayPK@player2
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', marginTop: 20 },
  label: { color: colors.navy, fontWeight: '600', marginBottom: 6 },
  hint: { marginTop: 16, color: colors.muted, fontSize: 12 },
});
