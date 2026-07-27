import { BOOKING_ADVANCE_PKR } from '@playpk/shared-types';
import { resolveAdvanceAmount } from '../resolveAdvance';

describe('resolveAdvanceAmount', () => {
  it('always returns flat advance even when a sport discount exists', () => {
    expect(resolveAdvanceAmount(null)).toBe(BOOKING_ADVANCE_PKR);
    expect(resolveAdvanceAmount(undefined)).toBe(BOOKING_ADVANCE_PKR);
    expect(resolveAdvanceAmount(20)).toBe(BOOKING_ADVANCE_PKR);
  });
});
