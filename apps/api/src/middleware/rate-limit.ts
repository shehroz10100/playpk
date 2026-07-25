import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { appConfig } from '../config/env';

/** Skip aggressive limits in automated tests. */
function skipInTest(): boolean {
  return appConfig.isTest || process.env.JEST_WORKER_ID != null;
}

/** Login / register / refresh — blunt force protection. */
export const authRateLimiter: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: appConfig.isProd ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many auth attempts. Try again later.',
    },
  },
  skip: skipInTest,
});

/** OTP request — stricter (SMS cost + guessing). */
export const otpRequestRateLimiter: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: appConfig.isProd ? 5 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many OTP requests. Try again later.',
    },
  },
  skip: skipInTest,
});

/** OTP verify — limit code guessing. */
export const otpVerifyRateLimiter: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: appConfig.isProd ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many OTP verification attempts. Try again later.',
    },
  },
  skip: skipInTest,
});
