import { BOOKING_ADVANCE_PKR } from '@playpk/shared-types';
import { resolveAdvanceAmount } from '../resolveAdvance';

describe('resolveAdvanceAmount', () => {
  it('returns flat advance when no discount', () => {
    expect(resolveAdvanceAmount(null)).toBe(BOOKING_ADVANCE_PKR);
    expect(resolveAdvanceAmount(undefined)).toBe(BOOKING_ADVANCE_PKR);
    expect(resolveAdvanceAmount(0)).toBe(BOOKING_ADVANCE_PKR);
  });

  it('applies sport percent off to advance', () => {
    expect(resolveAdvanceAmount(20)).toBe(800);
  });
});
