import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { appConfig } from '../config/env';
import type { UserRole } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  email?: string | null;
  phone?: string | null;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  jti: string;
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, appConfig.jwt.accessSecret, {
    expiresIn: appConfig.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: string, jti: string): string {
  return jwt.sign(
    { sub: userId, type: 'refresh', jti } satisfies RefreshTokenPayload,
    appConfig.jwt.refreshSecret,
    { expiresIn: appConfig.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'] },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, appConfig.jwt.accessSecret) as AccessTokenPayload;
  if (payload.type !== 'access') {
    throw new Error('Invalid access token type');
  }
  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, appConfig.jwt.refreshSecret) as RefreshTokenPayload;
  if (payload.type !== 'refresh') {
    throw new Error('Invalid refresh token type');
  }
  return payload;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newRefreshJti(): string {
  return randomBytes(16).toString('hex');
}

/** Parse durations like 15m / 7d into a Date for DB expiry. */
export function expiresAtFromDuration(duration: string, from = new Date()): Date {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const ms =
    unit === 's'
      ? amount * 1000
      : unit === 'm'
        ? amount * 60 * 1000
        : unit === 'h'
          ? amount * 60 * 60 * 1000
          : amount * 24 * 60 * 60 * 1000;
  return new Date(from.getTime() + ms);
}
