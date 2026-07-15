import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser } from '@playpk/shared-types';

export type { AuthUser };

const KEYS = {
  access: 'playpk_access',
  refresh: 'playpk_refresh',
  user: 'playpk_user',
  city: 'playpk_city',
  onboarded: 'playpk_onboarded',
};

export async function saveSession(input: {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}) {
  await AsyncStorage.multiSet([
    [KEYS.access, input.accessToken],
    [KEYS.refresh, input.refreshToken],
    [KEYS.user, JSON.stringify(input.user)],
  ]);
}

export async function clearSession() {
  await AsyncStorage.multiRemove([KEYS.access, KEYS.refresh, KEYS.user]);
}

export async function getAccessToken() {
  return AsyncStorage.getItem(KEYS.access);
}

export async function getRefreshToken() {
  return AsyncStorage.getItem(KEYS.refresh);
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem(KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function setCity(city: string) {
  await AsyncStorage.setItem(KEYS.city, city);
  await AsyncStorage.setItem(KEYS.onboarded, '1');
}

export async function getCity() {
  return AsyncStorage.getItem(KEYS.city);
}

export async function isOnboarded() {
  return (await AsyncStorage.getItem(KEYS.onboarded)) === '1';
}
