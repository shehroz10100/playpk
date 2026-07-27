import { BOOKING_ADVANCE_PKR } from '@playpk/shared-types';
import { applyPercentOff } from '../services/sport-discount.service';

/**
 * Flat online advance (PKR) per slot. Sport % discounts apply to the advance
 * the same way (e.g. 20% off → Rs 800). Full court price is paid at the venue.
 */
export function resolveAdvanceAmount(discountPercent: number | null | undefined): number {
  if (discountPercent == null || discountPercent <= 0) return BOOKING_ADVANCE_PKR;
  return applyPercentOff(BOOKING_ADVANCE_PKR, discountPercent);
}
