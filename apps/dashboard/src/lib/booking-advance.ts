import { BOOKING_ADVANCE_PKR } from '@playpk/shared-types';

/** Online advance per slot; sport % off applies to the advance (1000 → 800 at 20%). */
export function bookingAdvancePkr(discountPercent?: number | null): number {
  if (discountPercent == null || discountPercent <= 0) return BOOKING_ADVANCE_PKR;
  const pct = Math.min(90, Math.max(0, discountPercent));
  return Math.round(BOOKING_ADVANCE_PKR * (1 - pct / 100) * 100) / 100;
}

export function bookingAdvanceTotal(
  slotCount: number,
  discountPercent?: number | null,
): number {
  return bookingAdvancePkr(discountPercent) * Math.max(0, slotCount);
}
