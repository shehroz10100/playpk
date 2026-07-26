import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
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
import { normalizePkPhone } from '../lib/phone';
import { verifyGoogleIdToken } from '../lib/google-auth';
import { sendEmail } from '../lib/email';
import { redis } from '../lib/redis';

const SIGNUP_TTL_SECONDS = 15 * 60;
const RESET_TTL_SECONDS = 30 * 60;

function resetKey(token: string): string {
  return `pwdreset:${token}`;
}

type PendingSignup = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  passwordHash: string;
};

function signupKey(phone: string): string {
  return `signup:${phone}`;
}

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

export async function startPlayerRegistration(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = normalizePkPhone(input.phone);

  if (firstName.length < 1 || lastName.length < 1) {
    throw new AppError('First and last name are required', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (input.password.length < 8) {
    throw new AppError('Password must be at least 8 characters', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (input.password !== input.confirmPassword) {
    throw new AppError('Passwords do not match', {
      statusCode: 400,
      code: 'PASSWORD_MISMATCH',
    });
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new AppError('Email already registered', { statusCode: 409, code: 'EMAIL_EXISTS' });
  }
  const existingPhone = await prisma.user.findUnique({ where: { phone } });
  if (existingPhone) {
    throw new AppError('Phone already registered', { statusCode: 409, code: 'PHONE_EXISTS' });
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const pending: PendingSignup = { firstName, lastName, email, phone, passwordHash };
  await redis.set(signupKey(phone), JSON.stringify(pending), 'EX', SIGNUP_TTL_SECONDS);

  const otp = await issueOtp(phone);
  return {
    phone,
    message: 'Verification code sent to your phone.',
    expiresInSeconds: otp.expiresInSeconds,
    /** Local/dev only — real SMS is mocked; code is also in API logs. */
    ...(otp.code ? { devOtp: otp.code } : {}),
  };
}

export async function completePlayerRegistration(input: { phone: string; code: string }) {
  const phone = normalizePkPhone(input.phone);
  const valid = await verifyOtp(phone, input.code.trim());
  if (!valid) {
    throw new AppError('Invalid or expired verification code', {
      statusCode: 401,
      code: 'INVALID_OTP',
    });
  }

  const raw = await redis.get(signupKey(phone));
  if (!raw) {
    throw new AppError('Signup session expired. Please create your account again.', {
      statusCode: 410,
      code: 'SIGNUP_EXPIRED',
    });
  }

  let pending: PendingSignup;
  try {
    pending = JSON.parse(raw) as PendingSignup;
  } catch {
    await redis.del(signupKey(phone));
    throw new AppError('Signup session invalid. Please create your account again.', {
      statusCode: 410,
      code: 'SIGNUP_EXPIRED',
    });
  }

  if (pending.phone !== phone) {
    throw new AppError('Phone mismatch for signup session', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  // Re-check uniqueness in case another signup completed meanwhile
  const existingEmail = await prisma.user.findUnique({ where: { email: pending.email } });
  if (existingEmail) {
    await redis.del(signupKey(phone));
    throw new AppError('Email already registered', { statusCode: 409, code: 'EMAIL_EXISTS' });
  }
  const existingPhone = await prisma.user.findUnique({ where: { phone } });
  if (existingPhone) {
    await redis.del(signupKey(phone));
    throw new AppError('Phone already registered', { statusCode: 409, code: 'PHONE_EXISTS' });
  }

  const fullName = `${pending.firstName} ${pending.lastName}`.trim();
  const user = await prisma.user.create({
    data: {
      name: fullName,
      email: pending.email,
      phone: pending.phone,
      passwordHash: pending.passwordHash,
      role: UserRole.PLAYER,
      playerProfile: {
        create: {
          onboardingComplete: true,
        },
      },
    },
  });

  await redis.del(signupKey(phone));
  return issueTokenPair(user);
}

export async function loginWithGoogle(input: {
  idToken?: string;
  email?: string;
  name?: string;
}) {
  let email: string;
  let name: string;

  if (input.idToken?.trim()) {
    const identity = await verifyGoogleIdToken(input.idToken.trim());
    email = identity.email;
    name = identity.name;
  } else if (appConfig.allowLocalGoogleAuth && input.email?.trim()) {
    // Localhost-only path: account picker without Google Cloud client ID.
    email = input.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new AppError('Enter a valid Google email', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    name = (input.name?.trim() || email.split('@')[0] || 'Player').slice(0, 80);
  } else {
    throw new AppError('Google sign-in requires a Google account token', {
      statusCode: 400,
      code: 'GOOGLE_TOKEN_REQUIRED',
    });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        email,
        role: UserRole.PLAYER,
        playerProfile: {
          create: { onboardingComplete: true },
        },
      },
    });
  }

  if (user.suspendedAt) {
    throw new AppError('Account suspended. Contact PlayPK support.', {
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
    });
  }

  // Google sign-in is for customers on this portal
  if (user.role !== UserRole.PLAYER && user.role !== UserRole.GUEST) {
    throw new AppError('This Google account is linked to a staff role. Use email sign-in.', {
      statusCode: 403,
      code: 'STAFF_USE_PASSWORD',
    });
  }

  return issueTokenPair(user);
}

export async function requestOtp(phone: string) {
  const normalized = normalizePkPhone(phone);
  const user = await prisma.user.findUnique({ where: { phone: normalized } });
  if (!user) {
    // Avoid user enumeration for phone; still issue OTP for registration flow later.
    // For MVP login: require phone to exist.
    throw new AppError('No account found for this phone', { statusCode: 404, code: 'USER_NOT_FOUND' });
  }
  return issueOtp(normalized);
}

export async function loginWithOtp(phone: string, code: string) {
  const normalized = normalizePkPhone(phone);
  const valid = await verifyOtp(normalized, code);
  if (!valid) {
    throw new AppError('Invalid or expired OTP', { statusCode: 401, code: 'INVALID_OTP' });
  }
  const user = await prisma.user.findUnique({ where: { phone: normalized } });
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

/**
 * Request a password reset email. Always returns a generic message to avoid
 * email enumeration. In non-production (or mock email), may include `devResetToken`.
 */
export async function requestPasswordReset(input: { email: string }) {
  const email = input.email.trim().toLowerCase();
  const generic = {
    message: 'If an account exists for that email, we sent a password reset link.',
    expiresInSeconds: RESET_TTL_SECONDS,
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.suspendedAt) {
    return generic;
  }

  const token = randomBytes(32).toString('hex');
  await redis.set(resetKey(token), user.id, 'EX', RESET_TTL_SECONDS);

  const resetUrl = `${appConfig.frontendUrl}/login?mode=reset&token=${token}`;
  const text = [
    'Reset your PlayPK password',
    '',
    `Open this link within 30 minutes:`,
    resetUrl,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');

  const mail = await sendEmail({
    to: email,
    subject: 'Reset your PlayPK password',
    text,
    html: `<p>Reset your PlayPK password</p><p><a href="${resetUrl}">Choose a new password</a></p><p>This link expires in 30 minutes.</p>`,
  });

  return {
    ...generic,
    emailSent: mail.provider === 'resend',
    provider: mail.provider,
    // Only when email was mocked — UI auto-opens "Create new password".
    ...(mail.provider === 'mock' ? { devResetToken: token, resetUrl } : {}),
  };
}

export async function resetPassword(input: {
  token: string;
  password: string;
  confirmPassword: string;
}) {
  const token = input.token.trim();
  if (token.length < 32) {
    throw new AppError('Invalid or expired reset link', {
      statusCode: 400,
      code: 'INVALID_RESET_TOKEN',
    });
  }
  if (input.password.length < 8) {
    throw new AppError('Password must be at least 8 characters', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (input.password !== input.confirmPassword) {
    throw new AppError('Passwords do not match', {
      statusCode: 400,
      code: 'PASSWORD_MISMATCH',
    });
  }

  const userId = await redis.get(resetKey(token));
  if (!userId) {
    throw new AppError('Invalid or expired reset link', {
      statusCode: 400,
      code: 'INVALID_RESET_TOKEN',
    });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.suspendedAt) {
    await redis.del(resetKey(token));
    throw new AppError('Invalid or expired reset link', {
      statusCode: 400,
      code: 'INVALID_RESET_TOKEN',
    });
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  await redis.del(resetKey(token));

  // Invalidate existing sessions
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return { message: 'Password updated. You can sign in with your new password.' };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  return publicUser(user);
}
