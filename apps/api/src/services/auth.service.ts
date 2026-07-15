import bcrypt from 'bcryptjs';
import { UserRole, type User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import {
  expiresAtFromDuration,
  hashToken,
  newRefreshJti,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/jwt';
import { appConfig } from '../config/env';
import { issueOtp, verifyOtp } from '../lib/otp';

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    loyaltyPoints: user.loyaltyPoints,
    loyaltyTier: user.loyaltyTier,
    walletBalance: Number(user.walletBalance),
    createdAt: user.createdAt,
  };
}

async function issueTokenPair(user: User) {
  const jti = newRefreshJti();
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    email: user.email,
    phone: user.phone,
  });
  const refreshToken = signRefreshToken(user.id, jti);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: expiresAtFromDuration(appConfig.jwt.refreshExpiresIn),
    },
  });
  return { accessToken, refreshToken, user: publicUser(user) };
}

export async function registerUser(input: {
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
}) {
  if (!input.email && !input.phone) {
    throw new AppError('Email or phone is required', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError('Email already registered', { statusCode: 409, code: 'EMAIL_EXISTS' });
    }
  }
  if (input.phone) {
    const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw new AppError('Phone already registered', { statusCode: 409, code: 'PHONE_EXISTS' });
    }
  }

  // Only PLAYER self-registration via public API; elevated roles require existing seed/admin
  const role = input.role && input.role === UserRole.PLAYER ? UserRole.PLAYER : UserRole.PLAYER;
  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : null;

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role,
    },
  });

  return issueTokenPair(user);
}

export async function loginWithPassword(input: { email?: string; phone?: string; password: string }) {
  const email = input.email?.trim().toLowerCase();
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : input.phone
      ? await prisma.user.findUnique({ where: { phone: input.phone } })
      : null;

  if (!user?.passwordHash) {
    throw new AppError('Invalid credentials', { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    throw new AppError('Invalid credentials', { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  }

  if (user.suspendedAt) {
    throw new AppError('Account suspended. Contact PlayPK support.', {
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
    });
  }

  return issueTokenPair(user);
}

export async function requestOtp(phone: string) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    // Avoid user enumeration for phone; still issue OTP for registration flow later.
    // For MVP login: require phone to exist.
    throw new AppError('No account found for this phone', { statusCode: 404, code: 'USER_NOT_FOUND' });
  }
  return issueOtp(phone);
}

export async function loginWithOtp(phone: string, code: string) {
  const valid = await verifyOtp(phone, code);
  if (!valid) {
    throw new AppError('Invalid or expired OTP', { statusCode: 401, code: 'INVALID_OTP' });
  }
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    throw new AppError('No account found for this phone', { statusCode: 404, code: 'USER_NOT_FOUND' });
  }
  if (user.suspendedAt) {
    throw new AppError('Account suspended. Contact PlayPK support.', {
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
    });
  }
  return issueTokenPair(user);
}

export async function refreshSession(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid refresh token', { statusCode: 401, code: 'INVALID_REFRESH' });
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
    throw new AppError('Invalid refresh token', { statusCode: 401, code: 'INVALID_REFRESH' });
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
  return issueTokenPair(user);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  return publicUser(user);
}
