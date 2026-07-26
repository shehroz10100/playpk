import { appConfig } from '../config/env';
import { AppError } from './errors';

export type SendEmailResult = { provider: 'resend' | 'mock' };

/**
 * Send transactional email. Uses Resend when RESEND_API_KEY is set;
 * otherwise mocks in non-production (logs body). Production without Resend fails.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  const resendApiKey = appConfig.email.resendApiKey;
  // Resend allows beth.t@example.com for testing without a verified domain.
  const emailFrom =
    appConfig.email.emailFrom ||
    (resendApiKey ? 'PlayPK <beth.t@example.com>' : '');

  if (resendApiKey && emailFrom) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
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
      console.error(`[Email] Resend error: ${detail}`);
      throw new AppError('Failed to send email. Try again shortly.', {
        statusCode: 502,
        code: 'EMAIL_SEND_FAILED',
        details: appConfig.isProd ? undefined : detail,
      });
    }
    console.log(`[Email] Sent via Resend to …${input.to.slice(-12)}`);
    return { provider: 'resend' };
  }

  if (appConfig.isProd) {
    throw new AppError(
      'Email delivery is not configured. Set RESEND_API_KEY (and optionally EMAIL_FROM) on the API.',
      { statusCode: 503, code: 'EMAIL_NOT_CONFIGURED' },
    );
  }

  console.log(`[MockEmail] to=${input.to} subject=${input.subject}\n${input.text}`);
  return { provider: 'mock' };
}
