import { appConfig } from '../config/env';
import { AppError } from './errors';

export type SendSmsResult = { provider: 'twilio' | 'mock' };

/**
 * Send an SMS. Uses Twilio when credentials are configured; otherwise mocks
 * in non-production. Production without Twilio fails loudly so we never claim
 * a message was sent when it was not.
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const { twilio } = appConfig.sms;
  const configured =
    Boolean(twilio.accountSid) &&
    Boolean(twilio.authToken) &&
    Boolean(twilio.fromNumber || twilio.messagingServiceSid);

  if (configured) {
    await sendViaTwilio(to, body);
    return { provider: 'twilio' };
  }

  if (appConfig.isProd) {
    throw new AppError(
      'SMS delivery is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER (or TWILIO_MESSAGING_SERVICE_SID) on the API.',
      { statusCode: 503, code: 'SMS_NOT_CONFIGURED' },
    );
  }

  console.log(`[MockSMS] to=${to} body=${body}`);
  return { provider: 'mock' };
}

async function sendViaTwilio(to: string, body: string): Promise<void> {
  const { accountSid, authToken, fromNumber, messagingServiceSid } = appConfig.sms.twilio;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, Body: body });
  if (messagingServiceSid) {
    params.set('MessagingServiceSid', messagingServiceSid);
  } else if (fromNumber) {
    params.set('From', fromNumber);
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { message?: string; code?: number };
      detail = data.message || detail;
      console.error(`[SMS] Twilio error code=${data.code ?? 'n/a'} message=${detail}`);
    } catch {
      console.error(`[SMS] Twilio HTTP ${res.status}`);
    }
    throw new AppError('Failed to send verification SMS. Try again shortly.', {
      statusCode: 502,
      code: 'SMS_SEND_FAILED',
      details: appConfig.isProd ? undefined : detail,
    });
  }
}
