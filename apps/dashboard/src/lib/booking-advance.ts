import { BOOKING_ADVANCE_PKR } from '@playpk/shared-types';

/** Online advance is always Rs 1000 per slot — sport discounts do not reduce it. */
export function bookingAdvancePkr(): number {
  return BOOKING_ADVANCE_PKR;
}

export function bookingAdvanceTotal(slotCount: number): number {
  return BOOKING_ADVANCE_PKR * Math.max(0, slotCount);
}
