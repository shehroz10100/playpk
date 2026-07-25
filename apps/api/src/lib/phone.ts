import { AppError } from './errors';

/**
 * Normalize Pakistan-centric phone input to E.164 (+92…).
 * Accepts: +92300…, 92300…, 0300…, 300…
 */
export function normalizePkPhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '').trim();
  if (!digits) {
    throw new AppError('Phone number is required', { statusCode: 400, code: 'VALIDATION_ERROR' });
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
    throw new AppError('Enter a valid phone number (e.g. 03001234567)', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  return normalized;
}
