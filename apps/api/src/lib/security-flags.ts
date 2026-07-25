import { appConfig } from '../config/env';
import { AppError } from './errors';

/** Free self-serve wallet top-ups + auto-succeeding mock charges. */
export function mockPaymentsAllowed(): boolean {
  return appConfig.allowMockPayments;
}

export function assertMockPaymentsAllowed(action = 'Mock payments'): void {
  if (!mockPaymentsAllowed()) {
    throw new AppError(`${action} are disabled. Use a verified payment method.`, {
      statusCode: 403,
      code: 'MOCK_PAYMENTS_DISABLED',
    });
  }
}
