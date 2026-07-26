import { NextResponse } from 'next/server';
import {
  createPasswordBridge,
  openPendingReset,
  railwayApiBase,
  resetCookieName,
  resetOtpMatches,
} from '@/lib/email-otp';

export const runtime = 'nodejs';

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      code?: string;
      password?: string;
      confirmPassword?: string;
      token?: string;
    };

    // Legacy link token resets still go to Railway.
    if (body.token && String(body.token).length >= 32) {
      const railwayRes = await fetch(`${railwayApiBase()}/api/auth/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: body.token,
          password: body.password,
          confirmPassword: body.confirmPassword,
        }),
      });
      const railwayJson = (await railwayRes.json()) as {
        success?: boolean;
        data?: unknown;
        error?: { code?: string; message?: string };
      };
      if (!railwayRes.ok || !railwayJson.success) {
        return jsonError(
          railwayJson.error?.message || 'Could not reset password',
          railwayRes.status || 502,
          railwayJson.error?.code || 'RESET_FAILED',
        );
      }
      return NextResponse.json({ success: true, data: railwayJson.data });
    }

    const email = String(body.email ?? '').trim().toLowerCase();
    const code = String(body.code ?? '').trim();
    const password = String(body.password ?? '');
    const confirmPassword = String(body.confirmPassword ?? '');

    if (!email.includes('@') || code.length !== 6) {
      return jsonError('Invalid or expired verification code', 400, 'INVALID_OTP');
    }
    if (password.length < 8) {
      return jsonError('Password must be at least 8 characters', 400, 'VALIDATION_ERROR');
    }
    if (password !== confirmPassword) {
      return jsonError('Passwords do not match', 400, 'PASSWORD_MISMATCH');
    }

    const cookie = req.headers.get('cookie') ?? '';
    const match = cookie.match(new RegExp(`${resetCookieName()}=([^;]+)`));
    const token = match?.[1] ? decodeURIComponent(match[1]) : '';
    const pending = token ? openPendingReset(token) : null;

    if (!pending || pending.email !== email || !resetOtpMatches(pending, code)) {
      return jsonError('Invalid or expired verification code', 401, 'INVALID_OTP');
    }

    const bridge = createPasswordBridge({ email, password });
    const railwayRes = await fetch(`${railwayApiBase()}/api/auth/password/bridge-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        confirmPassword,
        exp: bridge.exp,
        sig: bridge.sig,
      }),
    });

    const railwayJson = (await railwayRes.json()) as {
      success?: boolean;
      data?: { message?: string };
      error?: { code?: string; message?: string };
    };

    if (!railwayRes.ok || !railwayJson.success) {
      return jsonError(
        railwayJson.error?.message ||
          'Could not update password. Redeploy the Railway API if bridge-reset is missing.',
        railwayRes.status || 502,
        railwayJson.error?.code || 'RESET_FAILED',
      );
    }

    const res = NextResponse.json({
      success: true,
      data: railwayJson.data ?? {
        message: 'Password updated. You can sign in with your new password.',
      },
    });
    res.cookies.set({
      name: resetCookieName(),
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
    return jsonError(message, 502, 'RESET_FAILED');
  }
}
