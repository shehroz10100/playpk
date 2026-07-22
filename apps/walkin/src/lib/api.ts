'use client';

import type { AuthTokensResponse, AuthUser } from '@playpk/shared-types';
import { getApiBase } from './api-base';
import { clearSession, getAccessToken, getRefreshToken, saveSession } from './auth';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = { success: false; error: { code: string; message: string } };

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
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
  saveSession(json.data);
  return json.data.accessToken;
}

export async function api<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const useAuth = options.auth !== false;
  let token = getAccessToken();
  if (useAuth && token) headers.set('Authorization', `Bearer ${token}`);

  const base = getApiBase();
  let res = await fetch(`${base}${path}`, { ...options, headers });

  if (res.status === 401 && useAuth) {
    token = await refreshAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      res = await fetch(`${base}${path}`, { ...options, headers });
    }
  }

  const json = (await res.json()) as ApiSuccess<T> | ApiFailure;
  if (!res.ok || !json.success) {
    const err = !json.success
      ? json.error
      : { code: 'HTTP_ERROR', message: 'Request failed' };
    throw new ApiError(err.message, res.status, err.code);
  }
  return json.data;
}

export type { AuthUser };
