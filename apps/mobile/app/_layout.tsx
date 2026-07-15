import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/lib/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/city" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/login" options={{ title: 'Sign in' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="teams" options={{ title: 'Teams' }} />
        <Stack.Screen name="tournament/[id]" options={{ title: 'Tournament' }} />
        <Stack.Screen name="venue/[id]" options={{ title: 'Venue' }} />
        <Stack.Screen name="court/[id]" options={{ title: 'Select slot' }} />
        <Stack.Screen name="booking/confirm" options={{ title: 'Confirm booking' }} />
        <Stack.Screen name="booking/ticket/[id]" options={{ title: 'Your ticket' }} />
      </Stack>
    </>
  );
}
