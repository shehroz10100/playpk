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
    process.env.NEXTAUTH_SECRET?.trim() ||
    // Last resort so signup cookie sealing still works if only email env is mis-set.
    process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
    'playpk-dev-otp-secret';
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
      ...(input.html ? { html: input.html } : {}),
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

/** Parse `Name <email@x.com>` or bare email into parts. */
export function parseEmailFrom(raw: string): { name: string; email: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, '') || 'PlayPK',
      email: match[2].trim(),
    };
  }
  return { name: 'PlayPK', email: trimmed };
}

/**
 * Brevo (free) can send FROM a verified personal Gmail without owning a domain.
 * https://app.brevo.com → Senders → Add sender → verify shehrozqureshi10100@gmail.com
 */
export async function sendBrevoEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ provider: 'brevo' }> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not set on Vercel');
  }

  const fromRaw =
    process.env.EMAIL_FROM?.trim() || 'PlayPK <shehrozqureshi10100@gmail.com>';
  const from = parseEmailFrom(fromRaw);

  if (from.email.endsWith('@resend.dev')) {
    throw new Error(
      'EMAIL_FROM is still beth.t@example.com. For Brevo, set EMAIL_FROM to your verified Gmail, e.g. PlayPK <shehrozqureshi10100@gmail.com>',
    );
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { name: from.name, email: from.email },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text,
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
    throw new Error(`Brevo email failed (${detail})`);
  }

  return { provider: 'brevo' };
}

/**
 * Prefer Brevo (works with verified Gmail, no custom domain), then Resend.
 */
export async function sendSignupEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ provider: 'brevo' | 'resend' }> {
  if (process.env.BREVO_API_KEY?.trim()) {
    return sendBrevoEmail(input);
  }

  try {
    return await sendResendEmail(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email';
    if (/domain|only send|verified|testing emails|own email/i.test(message)) {
      throw new Error(
        'Inbox delivery needs Brevo without a custom domain. Add BREVO_API_KEY on Vercel (Production), set EMAIL_FROM to PlayPK <shehrozqureshi10100@gmail.com>, verify that Gmail as a Brevo sender, then redeploy.',
      );
    }
    throw err;
  }
}

export function railwayApiBase(): string {
  return (
    process.env.API_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
    'https://api-production-2057.up.railway.app'
  );
}

const RESET_COOKIE_NAME = 'playpk_reset_otp';

export type PendingResetPayload = {
  email: string;
  otpHash: string;
  exp: number;
};

export function sealPendingReset(input: { email: string; code: string }): string {
  const body: PendingResetPayload = {
    email: input.email.trim().toLowerCase(),
    otpHash: hashOtp(input.code),
    exp: Date.now() + TTL_SECONDS * 1000,
  };
  const raw = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', otpSecret()).update(raw).digest('base64url');
  return `${raw}.${sig}`;
}

export function openPendingReset(token: string): PendingResetPayload | null {
  const [raw, sig] = token.split('.');
  if (!raw || !sig) return null;
  const expected = createHmac('sha256', otpSecret()).update(raw).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as PendingResetPayload;
    if (!parsed?.email || !parsed?.otpHash || !parsed?.exp) return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function resetOtpMatches(payload: PendingResetPayload, code: string): boolean {
  const got = Buffer.from(hashOtp(code));
  const expected = Buffer.from(payload.otpHash);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function resetCookieName(): string {
  return RESET_COOKIE_NAME;
}

function bridgeSecret(): string {
  // Must match apps/api bridgeResetPassword — do not use Brevo/Resend keys here.
  return (
    process.env.PASSWORD_RESET_BRIDGE_SECRET?.trim() ||
    'playpk-password-reset-bridge-v1'
  );
}

/** HMAC proof that Vercel verified the email OTP before asking Railway to set the password. */
export function createPasswordBridge(input: {
  email: string;
  password: string;
}): { exp: number; sig: string } {
  const exp = Date.now() + 2 * 60 * 1000;
  const email = input.email.trim().toLowerCase();
  const base = `${email}.${exp}.${input.password}`;
  const sig = createHmac('sha256', bridgeSecret()).update(base).digest('base64url');
  return { exp, sig };
}
