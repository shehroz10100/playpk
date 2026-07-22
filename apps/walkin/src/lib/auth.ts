'use client';

import type { AuthUser } from '@playpk/shared-types';

const ACCESS_KEY = 'playpk_walkin_access';
const REFRESH_KEY = 'playpk_walkin_refresh';
const USER_KEY = 'playpk_walkin_user';
const BRANCH_KEY = 'playpk_walkin_branch';

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
  localStorage.removeItem(BRANCH_KEY);
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

export function saveSelectedBranch(branchId: string) {
  localStorage.setItem(BRANCH_KEY, branchId);
}

export function getSelectedBranch(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(BRANCH_KEY);
}
