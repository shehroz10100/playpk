'use client';

import type { AuthTokensResponse } from '@playpk/shared-types';
import { getApiBase } from './api-base';
import { clearSession, getAccessToken, getRefreshToken, saveSession } from './auth';

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

/** Single-flight refresh so parallel 401s don't revoke each other's tokens. */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${getApiBase()}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clearSession();
        return null;
      }
      const json = (await res.json()) as ApiSuccess<AuthTokensResponse>;
      if (!json.success || !json.data?.accessToken) {
        clearSession();
        return null;
      }
      saveSession(json.data);
      return json.data.accessToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/** Ensure we have an access token (refresh if needed). */
export async function ensureAccessToken(): Promise<string | null> {
  const existing = getAccessToken();
  if (existing) return existing;
  if (!getRefreshToken()) return null;
  return refreshAccessToken();
}

export async function api<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const useAuth = options.auth !== false;
  let token = useAuth ? await ensureAccessToken() : getAccessToken();
  if (useAuth && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const base = getApiBase();
  let res = await fetch(`${base}${path}`, {
    ...options,
    headers,
    // Needed for signup email-OTP httpOnly cookie on same-origin Vercel routes.
    credentials: options.credentials ?? 'include',
  });

  if (res.status === 401 && useAuth) {
    token = await refreshAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      res = await fetch(`${base}${path}`, {
        ...options,
        headers,
        credentials: options.credentials ?? 'include',
      });
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
