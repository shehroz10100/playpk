import type { PaymentMethod } from '@playpk/shared-types';

/**
 * Payment provider abstraction.
 * Core booking logic must only depend on this interface so JazzCash,
 * Easypaisa, and card gateways can be plugged in later without refactors.
 */
export type { PaymentMethod };

export type PaymentIntentStatus =
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export interface CreatePaymentIntentInput {
  amount: number;
  currency: string;
  bookingId: string;
  userId: string;
  method: PaymentMethod;
  metadata?: Record<string, string>;
}

export interface PaymentIntent {
  id: string;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
  provider: string;
  clientSecret?: string;
  raw?: unknown;
}

export interface RefundInput {
  paymentIntentId: string;
  amount?: number;
  reason?: string;
}

export interface RefundResult {
  id: string;
  status: 'pending' | 'succeeded' | 'failed';
  amount: number;
}

export interface PaymentProvider {
  readonly name: string;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent>;
  getPaymentIntent(id: string): Promise<PaymentIntent>;
  refund(input: RefundInput): Promise<RefundResult>;
}
