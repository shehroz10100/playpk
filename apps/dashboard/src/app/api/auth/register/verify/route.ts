import { NextResponse } from 'next/server';
import {
  openPendingSignup,
  otpMatches,
  railwayApiBase,
  signupCookieName,
} from '@/lib/email-otp';

export const runtime = 'nodejs';

type Body = {
  email?: string;
  code?: string;
};

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const email = String(body.email ?? '').trim().toLowerCase();
    const code = String(body.code ?? '').trim();

    if (!email.includes('@') || code.length !== 6) {
      return jsonError('Invalid or expired verification code', 400, 'INVALID_OTP');
    }

    const cookie = req.headers.get('cookie') ?? '';
    const match = cookie.match(new RegExp(`${signupCookieName()}=([^;]+)`));
    const token = match?.[1] ? decodeURIComponent(match[1]) : '';
    const pending = token ? openPendingSignup(token) : null;

    if (!pending || pending.email !== email || !otpMatches(pending, code)) {
      return jsonError('Invalid or expired verification code', 401, 'INVALID_OTP');
    }

    const railwayRes = await fetch(`${railwayApiBase()}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${pending.firstName} ${pending.lastName}`.trim(),
        email: pending.email,
        phone: pending.phone,
        password: pending.password,
      }),
    });

    const railwayJson = (await railwayRes.json()) as {
      success?: boolean;
      data?: unknown;
      error?: { code?: string; message?: string };
    };

    if (!railwayRes.ok || !railwayJson.success) {
      return jsonError(
        railwayJson.error?.message || 'Could not create account',
        railwayRes.status || 502,
        railwayJson.error?.code || 'REGISTER_FAILED',
      );
    }

    const res = NextResponse.json({
      success: true,
      data: railwayJson.data,
    });
    res.cookies.set({
      name: signupCookieName(),
      value: '',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong';
    return jsonError(message, 502, 'REGISTER_FAILED');
  }
}
