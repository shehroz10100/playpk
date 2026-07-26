import { NextResponse } from 'next/server';
import {
  generateOtpCode,
  normalizePkPhone,
  sealPendingSignup,
  sendResendEmail,
  signupCookieMaxAge,
  signupCookieName,
} from '@/lib/email-otp';

export const runtime = 'nodejs';

type Body = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
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
    const firstName = String(body.firstName ?? '').trim();
    const lastName = String(body.lastName ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const confirmPassword = String(body.confirmPassword ?? '');

    if (firstName.length < 1 || lastName.length < 1) {
      return jsonError('First and last name are required', 400, 'VALIDATION_ERROR');
    }
    if (!email.includes('@')) {
      return jsonError('Enter a valid email', 400, 'VALIDATION_ERROR');
    }
    if (password.length < 8) {
      return jsonError('Password must be at least 8 characters', 400, 'VALIDATION_ERROR');
    }
    if (password !== confirmPassword) {
      return jsonError('Passwords do not match', 400, 'PASSWORD_MISMATCH');
    }

    let phone: string;
    try {
      phone = normalizePkPhone(String(body.phone ?? ''));
    } catch (err) {
      return jsonError(
        err instanceof Error ? err.message : 'Enter a valid phone number',
        400,
        'VALIDATION_ERROR',
      );
    }

    const code = generateOtpCode();
    const token = sealPendingSignup({
      firstName,
      lastName,
      email,
      phone,
      password,
      code,
    });

    await sendResendEmail({
      to: email,
      subject: 'Your PlayPK verification code',
      text: [
        'Your PlayPK verification code',
        '',
        `Code: ${code}`,
        '',
        'This code expires in 5 minutes.',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
      html: `<p>Your PlayPK verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:0.2em">${code}</p><p>This code expires in 5 minutes.</p>`,
    });

    const res = NextResponse.json({
      success: true,
      data: {
        email,
        phone,
        delivery: 'email',
        message: 'Verification code sent to your email.',
        expiresInSeconds: signupCookieMaxAge(),
      },
    });

    res.cookies.set({
      name: signupCookieName(),
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
    const code = message.includes('RESEND_API_KEY')
      ? 'EMAIL_NOT_CONFIGURED'
      : message.includes('domain')
        ? 'EMAIL_DOMAIN_REQUIRED'
        : 'EMAIL_SEND_FAILED';
    return jsonError(message, 502, code);
  }
}
