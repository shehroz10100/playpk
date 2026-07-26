import { redis } from './redis';
import { sendSms } from './sms';
import { sendEmail } from './email';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;

function otpKey(destination: string): string {
  return `otp:${destination}`;
}

function otpAttemptsKey(destination: string): string {
  return `otp:attempts:${destination}`;
}

async function storeAndReturnCode(
  destination: string,
): Promise<{ code: string; expiresInSeconds: number }> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await redis.set(otpKey(destination), code, 'EX', OTP_TTL_SECONDS);
  await redis.del(otpAttemptsKey(destination));
  return { code, expiresInSeconds: OTP_TTL_SECONDS };
}

/** Issue a phone OTP — stores in Redis and delivers via SMS (Twilio or mock). */
export async function issueOtp(
  phone: string,
): Promise<{ expiresInSeconds: number; code?: string }> {
  const { code, expiresInSeconds } = await storeAndReturnCode(phone);
  const message = `Your PlayPK verification code is ${code}. It expires in 5 minutes.`;
  const result = await sendSms(phone, message);

  if (result.provider === 'mock') {
    // Local/demo only — code is also returned as `devOtp` by the auth service.
    console.log(`[MockSMS] OTP for ${phone}: ${code}`);
    return { expiresInSeconds, code };
  }

  console.log(`[SMS] OTP dispatched for phone ending …${phone.slice(-4)}`);
  return { expiresInSeconds };
}

/** Issue an email OTP — stores in Redis and delivers via Resend (or mock). */
export async function issueEmailOtp(
  email: string,
  options?: { subject?: string },
): Promise<{ expiresInSeconds: number; code?: string }> {
  const normalized = email.trim().toLowerCase();
  const { code, expiresInSeconds } = await storeAndReturnCode(normalized);
  const subject = options?.subject ?? 'Your PlayPK verification code';
  const text = [
    subject,
    '',
    `Code: ${code}`,
    '',
    'This code expires in 5 minutes.',
    'If you did not request this, you can ignore this email.',
  ].join('\n');

  const result = await sendEmail({
    to: normalized,
    subject,
    text,
    html: `<p>${subject}</p><p style="font-size:24px;font-weight:700;letter-spacing:0.2em">${code}</p><p>This code expires in 5 minutes.</p>`,
  });

  if (result.provider === 'mock') {
    console.log(`[MockEmail] OTP for ${normalized}: ${code}`);
    return { expiresInSeconds, code };
  }

  console.log(`[Email] OTP dispatched to …${normalized.slice(-12)}`);
  return { expiresInSeconds };
}

export async function verifyOtp(destination: string, code: string): Promise<boolean> {
  const key = destination.trim().toLowerCase();
  const attemptsRaw = await redis.get(otpAttemptsKey(key));
  const attempts = Number(attemptsRaw ?? 0);
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(otpKey(key));
    return false;
  }

  const stored = await redis.get(otpKey(key));
  if (!stored || stored !== code) {
    await redis
      .multi()
      .incr(otpAttemptsKey(key))
      .expire(otpAttemptsKey(key), OTP_TTL_SECONDS)
      .exec();
    return false;
  }
  await redis.del(otpKey(key));
  await redis.del(otpAttemptsKey(key));
  return true;
}
