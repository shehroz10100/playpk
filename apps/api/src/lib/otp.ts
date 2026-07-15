import { redis } from './redis';

const OTP_TTL_SECONDS = 5 * 60;

function otpKey(phone: string): string {
  return `otp:${phone}`;
}

/** Mock SMS OTP provider — stores code in Redis and logs to console. */
export async function issueOtp(phone: string): Promise<{ expiresInSeconds: number }> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await redis.set(otpKey(phone), code, 'EX', OTP_TTL_SECONDS);
  // Mock SMS gateway
  console.log(`[MockSMS] OTP for ${phone}: ${code}`);
  return { expiresInSeconds: OTP_TTL_SECONDS };
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const stored = await redis.get(otpKey(phone));
  if (!stored || stored !== code) {
    return false;
  }
  await redis.del(otpKey(phone));
  return true;
}
