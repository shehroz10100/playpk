import Constants from 'expo-constants';
import type { AuthUser, AuthTokensResponse } from '@playpk/shared-types';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveSession,
} from './auth';

const RAILWAY_API = 'https://api-production-2057.up.railway.app';

function resolveApiBase(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) {
    return fromExtra.replace(/\/$/, '');
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  // Dev default: local API. Release/preview builds use Railway via app.config.js.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'http://localhost:4000';
  }
  return RAILWAY_API;
}

const API_BASE = resolveApiBase();

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type ApiSuccess<T> = { success: true; data: T; meta?: Record<string, unknown> };
type ApiFailure = { success: false; error: { code: string; message: string } };

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await clearSession();
    return null;
  }
  const json = (await res.json()) as ApiSuccess<AuthTokensResponse>;
  await saveSession(json.data);
  return json.data.accessToken;
}

export async function api<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Cache-Control', 'no-store');

  const useAuth = options.auth !== false;
  let token = await getAccessToken();
  if (useAuth && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && useAuth) {
    token = await refreshAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
    }
  }

  const json = (await res.json()) as ApiSuccess<T> | ApiFailure;
  if (!res.ok || !json.success) {
    const message = !json.success ? json.error.message : 'Request failed';
    const code = !json.success ? json.error.code : 'HTTP_ERROR';
    throw new ApiError(message, res.status, code);
  }
  return { data: json.data, meta: json.meta };
}

export { API_BASE };
export type { AuthUser };
