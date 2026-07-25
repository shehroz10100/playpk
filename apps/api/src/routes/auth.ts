import { z } from 'zod';
import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { validate } from '../middleware/validate';
import { authenticate, requireRoles } from '../middleware/auth';
import {
  authRateLimiter,
  otpRequestRateLimiter,
  otpVerifyRateLimiter,
} from '../middleware/rate-limit';
import { sendSuccess } from '../lib/errors';
import * as authService from '../services/auth.service';

export const authRouter = Router();

const registerSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email().optional(),
    phone: z.string().min(10).optional(),
    password: z.string().min(8).optional(),
  })
  .refine((d) => Boolean(d.email || d.phone), { message: 'email or phone required' });

authRouter.post('/register', authRateLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
});

const loginSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(10).optional(),
    password: z.string().min(1),
  })
  .refine((d) => Boolean(d.email || d.phone), { message: 'email or phone required' });

authRouter.post('/login', authRateLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.loginWithPassword(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

authRouter.post(
  '/otp/request',
  otpRequestRateLimiter,
  validate(z.object({ phone: z.string().min(10) })),
  async (req, res, next) => {
    try {
      const result = await authService.requestOtp(req.body.phone);
      sendSuccess(res, {
        message: 'If this phone is registered, an OTP has been sent.',
        expiresInSeconds: result.expiresInSeconds,
      });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  '/otp/verify',
  otpVerifyRateLimiter,
  validate(z.object({ phone: z.string().min(10), code: z.string().length(6) })),
  async (req, res, next) => {
    try {
      const result = await authService.loginWithOtp(req.body.phone, req.body.code);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  '/refresh',
  authRateLimiter,
  validate(z.object({ refreshToken: z.string().min(10) })),
  async (req, res, next) => {
    try {
      const result = await authService.refreshSession(req.body.refreshToken);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const me = await authService.getMe(req.user!.id);
    sendSuccess(res, me);
  } catch (error) {
    next(error);
  }
});

// Staff-only helper to confirm role gate works in dashboard smoke tests
authRouter.get(
  '/staff-ping',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  (_req, res) => {
    sendSuccess(res, { ok: true });
  },
);
