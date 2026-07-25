import { appConfig } from '../config/env';
import { AppError } from './errors';

export type GoogleIdentity = {
  email: string;
  name: string;
  sub: string;
  emailVerified: boolean;
};

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  sub?: string;
  error_description?: string;
};

/** Verify a Google ID token (GIS credential) against Google's tokeninfo endpoint. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const clientId = appConfig.googleClientId;
  if (!clientId) {
    throw new AppError('Google sign-in is not configured on the server', {
      statusCode: 503,
      code: 'GOOGLE_NOT_CONFIGURED',
    });
  }

  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const res = await fetch(url);
  const data = (await res.json()) as GoogleTokenInfo;

  if (!res.ok || !data.sub || !data.email) {
    throw new AppError(data.error_description || 'Invalid Google token', {
      statusCode: 401,
      code: 'INVALID_GOOGLE_TOKEN',
    });
  }

  if (data.aud !== clientId) {
    throw new AppError('Google token audience mismatch', {
      statusCode: 401,
      code: 'INVALID_GOOGLE_TOKEN',
    });
  }

  const emailVerified = data.email_verified === true || data.email_verified === 'true';
  if (!emailVerified) {
    throw new AppError('Google email is not verified', {
      statusCode: 401,
      code: 'GOOGLE_EMAIL_UNVERIFIED',
    });
  }

  return {
    email: data.email.toLowerCase(),
    name: (data.name || data.email.split('@')[0] || 'Player').trim(),
    sub: data.sub,
    emailVerified,
  };
}
