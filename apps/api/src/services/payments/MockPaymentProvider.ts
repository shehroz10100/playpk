import { randomUUID } from 'node:crypto';
import type {
  CreatePaymentIntentInput,
  PaymentIntent,
  PaymentProvider,
  RefundInput,
  RefundResult,
} from './PaymentProvider';
import { assertMockPaymentsAllowed } from '../../lib/security-flags';

/**
 * Mock payment provider for local development / MVP.
 * Always succeeds after a no-op "charge". Blocked when ALLOW_MOCK_PAYMENTS=false.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  private readonly intents = new Map<string, PaymentIntent>();

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    assertMockPaymentsAllowed('Auto-succeeding mock charges');
    const intent: PaymentIntent = {
      id: `mock_pi_${randomUUID()}`,
      status: 'succeeded',
      amount: input.amount,
      currency: input.currency,
      provider: this.name,
      clientSecret: `mock_secret_${randomUUID()}`,
      raw: { bookingId: input.bookingId, userId: input.userId, method: input.method },
    };
    this.intents.set(intent.id, intent);
    return intent;
  }

  async getPaymentIntent(id: string): Promise<PaymentIntent> {
    const intent = this.intents.get(id);
    if (!intent) {
      return {
        id,
        status: 'failed',
        amount: 0,
        currency: 'PKR',
        provider: this.name,
      };
    }
    return intent;
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    assertMockPaymentsAllowed('Mock payment refunds');
    const intent = this.intents.get(input.paymentIntentId);
    if (intent) {
      intent.status = 'refunded';
      this.intents.set(intent.id, intent);
    }
    return {
      id: `mock_re_${randomUUID()}`,
      status: 'succeeded',
      amount: input.amount ?? intent?.amount ?? 0,
    };
  }
}

let provider: PaymentProvider = new MockPaymentProvider();

export function getPaymentProvider(): PaymentProvider {
  return provider;
}

/** Test/DI helper — swap providers without touching booking code. */
export function setPaymentProvider(next: PaymentProvider): void {
  provider = next;
}
