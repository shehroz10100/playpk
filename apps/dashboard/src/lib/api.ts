'use client';

import { clearSession, getAccessToken, getStoredUser, saveSession } from './auth';
import { getSupabase } from './supabase';

/** Optional Express API for legacy data routes. Auth no longer uses this. */
const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

type ApiFailure = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await getSupabase().auth.refreshSession();
    if (error || !data.session) {
      await clearSession();
      return null;
    }
    const user = getStoredUser();
    if (user) {
      saveSession({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user,
      });
    } else {
      localStorage.setItem('playpk_access_token', data.session.access_token);
      localStorage.setItem('playpk_refresh_token', data.session.refresh_token);
    }
    return data.session.access_token;
  } catch {
    await clearSession();
    return null;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  if (!API_BASE) {
    throw new ApiError(
      'Data API is not configured (NEXT_PUBLIC_API_URL). Login uses Supabase; set the API URL only if you still need Express data routes.',
      503,
      'API_NOT_CONFIGURED',
    );
  }

  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const useAuth = options.auth !== false;
  let token = getAccessToken();
  if (useAuth && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && useAuth) {
    token = await refreshAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  const json = (await res.json()) as ApiSuccess<T> | ApiFailure;
  if (!res.ok || !json.success) {
    const err = !json.success
      ? json.error
      : { code: 'HTTP_ERROR', message: 'Request failed', details: undefined };
    throw new ApiError(err.message, res.status, err.code, err.details);
  }

  return { data: json.data, meta: json.meta };
}
