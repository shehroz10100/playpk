import { redis } from './redis';
import { appConfig } from '../config/env';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;

function otpKey(phone: string): string {
  return `otp:${phone}`;
}

function otpAttemptsKey(phone: string): string {
  return `otp:attempts:${phone}`;
}

/** Mock SMS OTP provider — stores code in Redis. Never logs codes in production. */
export async function issueOtp(
  phone: string,
): Promise<{ expiresInSeconds: number; code?: string }> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await redis.set(otpKey(phone), code, 'EX', OTP_TTL_SECONDS);
  await redis.del(otpAttemptsKey(phone));

  if (!appConfig.isProd) {
    // Local/demo only — production must use a real SMS gateway without logging secrets.
    console.log(`[MockSMS] OTP for ${phone}: ${code}`);
    return { expiresInSeconds: OTP_TTL_SECONDS, code };
  }

  console.log(`[SMS] OTP dispatched for phone ending …${phone.slice(-4)}`);
  return { expiresInSeconds: OTP_TTL_SECONDS };
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const attemptsRaw = await redis.get(otpAttemptsKey(phone));
  const attempts = Number(attemptsRaw ?? 0);
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(otpKey(phone));
    return false;
  }

  const stored = await redis.get(otpKey(phone));
  if (!stored || stored !== code) {
    await redis
      .multi()
      .incr(otpAttemptsKey(phone))
      .expire(otpAttemptsKey(phone), OTP_TTL_SECONDS)
      .exec();
    return false;
  }
  await redis.del(otpKey(phone));
  await redis.del(otpAttemptsKey(phone));
  return true;
}
