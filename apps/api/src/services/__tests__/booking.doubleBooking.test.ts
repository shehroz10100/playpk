import { BookingSource, BookingStatus, PaymentStatus, SlotStatus } from '@prisma/client';
import { acquireSlotLock, releaseSlotLock } from '../../lib/slotLock';
import { AppError } from '../../lib/errors';
import { createBooking } from '../booking.service';
import { prisma } from '../../lib/prisma';
import { getPaymentProvider } from '../payments/MockPaymentProvider';
import { resolvePrice } from '../../pricing/resolvePrice';
import { resolveWalkInCustomer } from '../walkin-customer.service';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    booking: {
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    loyaltyTransaction: {
      findFirst: jest.fn().mockResolvedValue({ id: 'already' }),
    },
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        loyaltyPoints: 0,
        loyaltyTier: 'BRONZE',
      }),
    },
  },
}));

jest.mock('../../lib/slotLock', () => ({
  acquireSlotLock: jest.fn(),
  releaseSlotLock: jest.fn(),
}));

jest.mock('../payments/MockPaymentProvider', () => ({
  getPaymentProvider: jest.fn(),
}));

jest.mock('../../pricing/resolvePrice', () => ({
  resolvePrice: jest.fn(),
}));

jest.mock('../../lib/slotEvents', () => ({
  publishSlotStatusChanged: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../walkin-customer.service', () => ({
  resolveWalkInCustomer: jest.fn().mockResolvedValue({
    userId: 'guest_1',
    guestName: 'Walk-in Guest',
    guestPhone: null,
  }),
}));

jest.mock('../notify.service', () => ({
  notifyUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../loyalty.service', () => ({
  awardLoyaltyForBooking: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../waitlist.service', () => ({
  promoteNextWaitlistedUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../wallet.service', () => ({
  debitWallet: jest.fn(),
  creditWalletRefund: jest.fn(),
}));

const mockedAcquire = acquireSlotLock as jest.MockedFunction<typeof acquireSlotLock>;
const mockedRelease = releaseSlotLock as jest.MockedFunction<typeof releaseSlotLock>;
const mockedPrisma = prisma as unknown as {
  $transaction: jest.Mock;
  booking: { update: jest.Mock; findUniqueOrThrow: jest.Mock };
};
const mockedGetPayment = getPaymentProvider as jest.MockedFunction<typeof getPaymentProvider>;
const mockedResolvePrice = resolvePrice as jest.MockedFunction<typeof resolvePrice>;
const mockedWalkIn = resolveWalkInCustomer as jest.MockedFunction<typeof resolveWalkInCustomer>;

function availableTx(userId = 'user_a') {
  return {
    slot: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'slot_1',
        status: SlotStatus.AVAILABLE,
        price: 3500,
        date: new Date('2026-07-25T00:00:00.000Z'),
        startTime: '19:00',
        courtId: 'court_1',
        court: { id: 'court_1', branchId: 'branch_1' },
        bookings: [],
      }),
      update: jest.fn(),
    },
    booking: {
      create: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
        id: 'booking_1',
        userId: args.data.userId ?? userId,
        slotId: 'slot_1',
        status: args.data.status ?? BookingStatus.PENDING,
        totalAmount: args.data.totalAmount ?? 1000,
        paymentStatus: args.data.paymentStatus ?? PaymentStatus.PENDING,
        paymentIntentId: null,
        qrCode: 'qr',
        createdAt: new Date(),
        cancelledAt: null,
        bookingSource: args.data.bookingSource,
        paymentMethod: args.data.paymentMethod,
        guestName: args.data.guestName,
        guestPhone: args.data.guestPhone,
      })),
    },
    waitlist: { deleteMany: jest.fn() },
  };
}

describe('createBooking conflict prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRelease.mockResolvedValue(undefined);
    mockedGetPayment.mockReturnValue({
      name: 'mock',
      createPaymentIntent: jest.fn().mockResolvedValue({
        id: 'mock_pi_1',
        status: 'succeeded',
        amount: 1000,
        currency: 'PKR',
        provider: 'mock',
      }),
      getPaymentIntent: jest.fn(),
      refund: jest.fn(),
    });
    mockedResolvePrice.mockResolvedValue({
      price: 3500,
      basePrice: 3500,
      currency: 'PKR',
      channel: 'ONLINE',
      dayType: 'WEEKDAY' as never,
      appliedRuleId: null,
      appliedRuleLabel: null,
    });
  });

  it('rejects when Redis lock cannot be acquired', async () => {
    mockedAcquire.mockResolvedValue(null);
    await expect(createBooking({ userId: 'user_a', slotId: 'slot_1' })).rejects.toMatchObject({
      code: 'SLOT_LOCKED',
      statusCode: 409,
    } satisfies Partial<AppError>);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects when slot is already BOOKED', async () => {
    mockedAcquire.mockResolvedValue('lock-token');
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        slot: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'slot_1',
            status: SlotStatus.BOOKED,
            price: 3500,
            date: new Date(),
            startTime: '19:00',
            courtId: 'court_1',
            court: { id: 'court_1', branchId: 'branch_1' },
            bookings: [{ id: 'existing' }],
          }),
        },
        booking: { create: jest.fn() },
        waitlist: { deleteMany: jest.fn() },
      };
      return fn(tx);
    });

    await expect(createBooking({ userId: 'user_a', slotId: 'slot_1' })).rejects.toMatchObject({
      code: 'SLOT_UNAVAILABLE',
    });
    expect(mockedRelease).toHaveBeenCalledWith('slot_1', 'lock-token');
  });

  it('rejects BLOCKED slots from online and walk-in', async () => {
    mockedAcquire.mockResolvedValue('lock-token');
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        slot: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'slot_1',
            status: SlotStatus.MAINTENANCE,
            price: 3500,
            date: new Date(),
            startTime: '19:00',
            courtId: 'court_1',
            court: { id: 'court_1', branchId: 'branch_1' },
            bookings: [],
          }),
        },
        booking: { create: jest.fn() },
        waitlist: { deleteMany: jest.fn() },
      };
      return fn(tx);
    });

    await expect(
      createBooking({ userId: 'user_a', slotId: 'slot_1', source: BookingSource.ONLINE }),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });

    await expect(
      createBooking({
        slotId: 'slot_1',
        source: BookingSource.WALK_IN,
        walkInCustomer: { name: 'Guest' },
        paymentMethod: 'CASH',
      }),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
  });

  it('allows only one of concurrent ONLINE + WALK_IN on the same slot', async () => {
    let held = false;
    mockedAcquire.mockImplementation(async () => {
      if (held) return null;
      held = true;
      return 'lock-token-1';
    });
    mockedRelease.mockImplementation(async () => {
      held = false;
    });

    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(availableTx()),
    );

    mockedPrisma.booking.update.mockResolvedValue({
      id: 'booking_1',
      userId: 'user_a',
      slotId: 'slot_1',
      status: BookingStatus.CONFIRMED,
      totalAmount: 1000,
      paymentStatus: PaymentStatus.PAID,
      paymentIntentId: 'mock_pi_1',
      paymentMethod: 'mock',
      bookingSource: BookingSource.ONLINE,
      guestName: null,
      guestPhone: null,
      qrCode: 'qr',
      createdAt: new Date(),
      cancelledAt: null,
      user: { id: 'user_a', name: 'A', email: 'a@x.com', phone: null },
      slot: {
        startTime: '19:00',
        endTime: '20:00',
        date: new Date(),
        court: {
          name: 'Padel 1',
          branch: { name: 'Branch', company: { name: 'Co' } },
          sport: { name: 'Padel' },
        },
      },
    });

    mockedPrisma.booking.findUniqueOrThrow.mockResolvedValue({
      id: 'booking_w',
      userId: 'guest_1',
      slotId: 'slot_1',
      status: BookingStatus.CONFIRMED,
      totalAmount: 3500,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: 'CASH',
      bookingSource: BookingSource.WALK_IN,
      guestName: 'Walk-in Guest',
      guestPhone: null,
      qrCode: 'qr',
      createdAt: new Date(),
      cancelledAt: null,
      user: { id: 'guest_1', name: 'Walk-in Guest', email: null, phone: null },
      slot: {
        startTime: '19:00',
        endTime: '20:00',
        date: new Date(),
        court: {
          name: 'Padel 1',
          branch: { name: 'Branch', company: { name: 'Co' } },
          sport: { name: 'Padel' },
        },
      },
    });

    const [a, b] = await Promise.allSettled([
      createBooking({ userId: 'user_a', slotId: 'slot_1', source: BookingSource.ONLINE }),
      createBooking({
        slotId: 'slot_1',
        source: BookingSource.WALK_IN,
        walkInCustomer: { name: 'Walk-in Guest' },
        paymentMethod: 'CASH',
        createdByStaffId: 'staff_1',
      }),
    ]);

    const fulfilled = [a, b].filter((r) => r.status === 'fulfilled');
    const rejected = [a, b].filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'SLOT_LOCKED',
    });
    expect(mockedRelease).toHaveBeenCalled();
    expect(mockedWalkIn).toHaveBeenCalled();
  });
});
