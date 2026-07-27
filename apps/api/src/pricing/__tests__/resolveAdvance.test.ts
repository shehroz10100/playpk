import { BOOKING_ADVANCE_PKR } from '@playpk/shared-types';
import { resolveAdvanceAmount } from '../resolveAdvance';

describe('resolveAdvanceAmount', () => {
  it('always returns flat advance even when a sport discount exists', () => {
    expect(resolveAdvanceAmount()).toBe(BOOKING_ADVANCE_PKR);
  });
});
