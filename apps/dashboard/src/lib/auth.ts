'use client';

import type { AuthUser } from '@playpk/shared-types';
import { getSupabase } from './supabase';

export type { AuthUser };

const ACCESS_KEY = 'playpk_access_token';
const REFRESH_KEY = 'playpk_refresh_token';
const USER_KEY = 'playpk_user';

export function saveSession(input: {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}) {
  localStorage.setItem(ACCESS_KEY, input.accessToken);
  localStorage.setItem(REFRESH_KEY, input.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(input.user));
}

export async function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  try {
    await getSupabase().auth.signOut();
  } catch {
    // Env missing or already signed out — local keys already cleared.
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

type DbUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  loyaltyPoints: number;
  loyaltyTier: string;
  walletBalance: number | string;
  createdAt?: string;
};

export function mapDbUser(row: DbUser): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    loyaltyPoints: row.loyaltyPoints ?? 0,
    loyaltyTier: row.loyaltyTier ?? 'BRONZE',
    walletBalance: Number(row.walletBalance ?? 0),
    createdAt: row.createdAt,
  };
}

/** Sign in with Supabase Auth, then load PlayPK profile from public.User. */
export async function signInWithPassword(email: string, password: string): Promise<AuthUser> {
  const supabase = getSupabase();
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalized,
    password,
  });

  if (error || !data.session) {
    throw new Error(error?.message ?? 'Invalid credentials');
  }

  const { data: profile, error: profileError } = await supabase
    .from('User')
    .select('id, name, email, phone, role, loyaltyPoints, loyaltyTier, walletBalance, createdAt')
    .eq('email', normalized)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    throw new Error(profileError?.message ?? 'No PlayPK profile found for this account.');
  }

  const user = mapDbUser(profile as DbUser);
  saveSession({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user,
  });
  return user;
}

/** Refresh profile from Supabase (replaces Express /api/auth/me). */
export async function refreshProfile(): Promise<AuthUser | null> {
  const stored = getStoredUser();
  if (!stored?.email) return null;

  const { data: profile, error } = await getSupabase()
    .from('User')
    .select('id, name, email, phone, role, loyaltyPoints, loyaltyTier, walletBalance, createdAt')
    .eq('email', stored.email)
    .maybeSingle();

  if (error || !profile) return null;

  const user = mapDbUser(profile as DbUser);
  const access = getAccessToken();
  const refresh = getRefreshToken();
  if (access && refresh) {
    saveSession({ accessToken: access, refreshToken: refresh, user });
  }
  return user;
}
