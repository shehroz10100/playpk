jest.mock('../redis', () => ({
  redis: {
    duplicate: () => ({
      subscribe: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
    }),
    publish: jest.fn().mockResolvedValue(1),
  },
}));

import { BookingSource, SlotStatus } from '@prisma/client';
import { publishSlotStatusChanged, subscribeBranchSlots } from '../slotEvents';

describe('slotEvents realtime', () => {
  it('notifies branch subscribers within an acceptable window after publish', async () => {
    const received: unknown[] = [];
    const unsub = subscribeBranchSlots('branch_rt', (e) => received.push(e));

    const started = Date.now();
    await publishSlotStatusChanged({
      slotId: 'slot_rt',
      branchId: 'branch_rt',
      courtId: 'court_rt',
      status: SlotStatus.BOOKED,
      bookingSource: BookingSource.WALK_IN,
    });

    await new Promise((r) => setTimeout(r, 50));
    const elapsed = Date.now() - started;

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      type: 'slot.status.changed',
      slotId: 'slot_rt',
      branchId: 'branch_rt',
      status: SlotStatus.BOOKED,
      bookingSource: BookingSource.WALK_IN,
    });
    expect(elapsed).toBeLessThan(2000);
    unsub();
  });
});
