import { NextResponse } from 'next/server';
import {
  generateOtpCode,
  resetCookieName,
  sealPendingReset,
  sendSignupEmail,
  signupCookieMaxAge,
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
    const body = (await req.json()) as { email?: string };
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email.includes('@')) {
      return jsonError('Enter a valid email', 400, 'VALIDATION_ERROR');
    }

    const code = generateOtpCode();
    const token = sealPendingReset({ email, code });

    const preview =
      process.env.EMAIL_OTP_PREVIEW === 'true' ||
      process.env.EMAIL_OTP_PREVIEW === '1';

    if (!preview) {
      await sendSignupEmail({
        to: email,
        subject: 'Your PlayPK password reset code',
        text: [
          'Your PlayPK password reset code',
          '',
          `Code: ${code}`,
          '',
          'This code expires in 5 minutes.',
          'If you did not request this, you can ignore this email.',
        ].join('\n'),
        html: `<p>Your PlayPK password reset code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:0.2em">${code}</p><p>This code expires in 5 minutes.</p>`,
      });
    }

    const res = NextResponse.json({
      success: true,
      data: {
        message: preview
          ? 'Preview mode — enter the on-screen code, then choose a new password.'
          : 'If an account exists for that email, we sent a password reset code.',
        expiresInSeconds: signupCookieMaxAge(),
        emailSent: !preview,
        ...(preview ? { devOtp: code } : {}),
      },
    });

    res.cookies.set({
      name: resetCookieName(),
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: signupCookieMaxAge(),
    });

    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong';
    return jsonError(message, 502, 'EMAIL_SEND_FAILED');
  }
}
