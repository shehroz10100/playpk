import type { PaymentProvider } from '../PaymentProvider';
import { MockPaymentProvider } from '../MockPaymentProvider';

describe('MockPaymentProvider', () => {
  let provider: PaymentProvider;

  beforeEach(() => {
    provider = new MockPaymentProvider();
  });

  it('creates a succeeded payment intent', async () => {
    const intent = await provider.createPaymentIntent({
      amount: 3500,
      currency: 'PKR',
      bookingId: 'booking_1',
      userId: 'user_1',
      method: 'mock',
    });

    expect(intent.status).toBe('succeeded');
    expect(intent.amount).toBe(3500);
    expect(intent.provider).toBe('mock');
    expect(intent.id).toMatch(/^mock_pi_/);
  });

  it('refunds a payment intent', async () => {
    const intent = await provider.createPaymentIntent({
      amount: 4500,
      currency: 'PKR',
      bookingId: 'booking_2',
      userId: 'user_2',
      method: 'mock',
    });

    const refund = await provider.refund({
      paymentIntentId: intent.id,
      amount: 4500,
      reason: 'test',
    });

    expect(refund.status).toBe('succeeded');
    expect(refund.amount).toBe(4500);

    const updated = await provider.getPaymentIntent(intent.id);
    expect(updated.status).toBe('refunded');
  });
});
