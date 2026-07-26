import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'playpk_signup_otp';
const TTL_SECONDS = 5 * 60;

export type PendingSignupPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  otpHash: string;
  exp: number;
};

function otpSecret(): string {
  const secret =
    process.env.AUTH_OTP_SECRET?.trim() ||
    process.env.RESEND_API_KEY?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error('Missing AUTH_OTP_SECRET or RESEND_API_KEY on Vercel');
  }
  return secret;
}

export function hashOtp(code: string): string {
  return createHmac('sha256', otpSecret()).update(code).digest('hex');
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export function sealPendingSignup(
  payload: Omit<PendingSignupPayload, 'otpHash' | 'exp'> & { code: string },
): string {
  const body: PendingSignupPayload = {
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    phone: payload.phone,
    password: payload.password,
    otpHash: hashOtp(payload.code),
    exp: Date.now() + TTL_SECONDS * 1000,
  };
  const raw = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', otpSecret()).update(raw).digest('base64url');
  return `${raw}.${sig}`;
}

export function openPendingSignup(token: string): PendingSignupPayload | null {
  const [raw, sig] = token.split('.');
  if (!raw || !sig) return null;
  const expected = createHmac('sha256', otpSecret()).update(raw).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as PendingSignupPayload;
    if (!parsed?.email || !parsed?.otpHash || !parsed?.exp) return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function otpMatches(payload: PendingSignupPayload, code: string): boolean {
  const got = Buffer.from(hashOtp(code));
  const expected = Buffer.from(payload.otpHash);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function signupCookieName(): string {
  return COOKIE_NAME;
}

export function signupCookieMaxAge(): number {
  return TTL_SECONDS;
}

export function normalizePkPhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '').trim();
  if (!digits) {
    throw new Error('Phone number is required');
  }

  let normalized = digits;
  if (normalized.startsWith('+')) {
    normalized = `+${normalized.slice(1).replace(/\D/g, '')}`;
  } else {
    const only = normalized.replace(/\D/g, '');
    if (only.startsWith('92') && only.length >= 12) {
      normalized = `+${only}`;
    } else if (only.startsWith('0') && only.length >= 11) {
      normalized = `+92${only.slice(1)}`;
    } else if (only.length === 10) {
      normalized = `+92${only}`;
    } else {
      normalized = `+${only}`;
    }
  }

  if (!/^\+\d{10,15}$/.test(normalized)) {
    throw new Error('Enter a valid phone number (e.g. 03001234567)');
  }

  return normalized;
}

export async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ provider: 'resend' }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'Email delivery is not configured. Set RESEND_API_KEY on the Vercel project.',
    );
  }

  const emailFrom =
    process.env.EMAIL_FROM?.trim() || 'PlayPK <beth.t@example.com>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { message?: string };
      detail = data.message || detail;
    } catch {
      /* ignore */
    }
    const needsDomain =
      /domain|only send|verified|testing emails|own email/i.test(detail) ||
      res.status === 403;
    throw new Error(
      needsDomain
        ? 'Email could not be delivered. Verify a domain in Resend and set EMAIL_FROM on Vercel so codes can reach every new user.'
        : `Failed to send email (${detail})`,
    );
  }

  return { provider: 'resend' };
}

export function railwayApiBase(): string {
  return (
    process.env.API_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
    'https://api-production-2057.up.railway.app'
  );
}
