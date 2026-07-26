import { redis } from './redis';
import { sendSms } from './sms';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;

function otpKey(phone: string): string {
  return `otp:${phone}`;
}

function otpAttemptsKey(phone: string): string {
  return `otp:attempts:${phone}`;
}

/** Issue a phone OTP — stores in Redis and delivers via SMS (Twilio or mock). */
export async function issueOtp(
  phone: string,
): Promise<{ expiresInSeconds: number; code?: string }> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await redis.set(otpKey(phone), code, 'EX', OTP_TTL_SECONDS);
  await redis.del(otpAttemptsKey(phone));

  const message = `Your PlayPK verification code is ${code}. It expires in 5 minutes.`;
  const result = await sendSms(phone, message);

  if (result.provider === 'mock') {
    // Local/demo only — code is also returned as `devOtp` by the auth service.
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
