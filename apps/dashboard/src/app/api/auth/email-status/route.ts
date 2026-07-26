import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Safe diagnostics — never returns secret values. */
export async function GET() {
  const emailFrom = process.env.EMAIL_FROM?.trim() || '';
  return NextResponse.json({
    success: true,
    data: {
      hasBrevoKey: Boolean(process.env.BREVO_API_KEY?.trim()),
      hasResendKey: Boolean(process.env.RESEND_API_KEY?.trim()),
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
      emailFrom,
      emailFromIsGmail: /@gmail\.com>/i.test(emailFrom) || /@gmail\.com$/i.test(emailFrom),
      emailFromIsResendDev: /@resend\.dev>/i.test(emailFrom) || /@resend\.dev$/i.test(emailFrom),
      previewMode:
        process.env.EMAIL_OTP_PREVIEW === 'true' ||
        process.env.EMAIL_OTP_PREVIEW === '1',
      commitHint: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    },
  });
}
