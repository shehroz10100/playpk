import { BOOKING_ADVANCE_PKR } from '@playpk/shared-types';

/**
 * Flat online advance (PKR) per slot. Sport discounts never reduce the advance —
 * they only reduce the remaining balance paid at the venue.
 */
export function resolveAdvanceAmount(): number {
  return BOOKING_ADVANCE_PKR;
}

export function resolveAdvanceTotal(slotCount: number): number {
  return BOOKING_ADVANCE_PKR * Math.max(0, slotCount);
}
