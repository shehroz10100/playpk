'use client';

import type { AuthUser } from '@playpk/shared-types';

export type { AuthUser };

const ACCESS_KEY = 'playpk_access_token';
const REFRESH_KEY = 'playpk_refresh_token';
const USER_KEY = 'playpk_user';
const REMEMBER_KEY = 'playpk_remembered_credentials';

export type RememberedCredentials = {
  email: string;
  password: string;
};

export function saveSession(input: {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}) {
  localStorage.setItem(ACCESS_KEY, input.accessToken);
  localStorage.setItem(REFRESH_KEY, input.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(input.user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function saveRememberedCredentials(email: string, password: string) {
  localStorage.setItem(
    REMEMBER_KEY,
    JSON.stringify({ email: email.trim().toLowerCase(), password } satisfies RememberedCredentials),
  );
}

export function clearRememberedCredentials() {
  localStorage.removeItem(REMEMBER_KEY);
}

export function getRememberedCredentials(): RememberedCredentials | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(REMEMBER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RememberedCredentials>;
    if (typeof parsed.email !== 'string' || typeof parsed.password !== 'string') return null;
    return { email: parsed.email, password: parsed.password };
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}
