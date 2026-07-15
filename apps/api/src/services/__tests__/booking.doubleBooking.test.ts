import { BookingStatus, PaymentStatus, SlotStatus } from '@prisma/client';
import { acquireSlotLock, releaseSlotLock } from '../../lib/slotLock';
import { AppError } from '../../lib/errors';
import { createBooking } from '../booking.service';
import { prisma } from '../../lib/prisma';
import { getPaymentProvider } from '../payments/MockPaymentProvider';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    booking: {
      update: jest.fn(),
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

const mockedAcquire = acquireSlotLock as jest.MockedFunction<typeof acquireSlotLock>;
const mockedRelease = releaseSlotLock as jest.MockedFunction<typeof releaseSlotLock>;
const mockedPrisma = prisma as unknown as {
  $transaction: jest.Mock;
  booking: { update: jest.Mock };
};
const mockedGetPayment = getPaymentProvider as jest.MockedFunction<typeof getPaymentProvider>;

describe('createBooking double-booking prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRelease.mockResolvedValue(undefined);
    mockedGetPayment.mockReturnValue({
      name: 'mock',
      createPaymentIntent: jest.fn().mockResolvedValue({
        id: 'mock_pi_1',
        status: 'succeeded',
        amount: 3500,
        currency: 'PKR',
        provider: 'mock',
      }),
      getPaymentIntent: jest.fn(),
      refund: jest.fn(),
    });
  });

  it('rejects when Redis lock cannot be acquired (another booking in flight)', async () => {
    mockedAcquire.mockResolvedValue(null);

    await expect(createBooking({ userId: 'user_a', slotId: 'slot_1' })).rejects.toMatchObject({
      code: 'SLOT_LOCKED',
      statusCode: 409,
    } satisfies Partial<AppError>);

    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockedRelease).not.toHaveBeenCalled();
  });

  it('rejects when slot is already BOOKED even after lock acquisition', async () => {
    mockedAcquire.mockResolvedValue('lock-token');
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        slot: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'slot_1',
            status: SlotStatus.BOOKED,
            price: 3500,
            booking: { id: 'existing' },
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

  it('only one of two concurrent callers proceeds past the Redis lock', async () => {
    let held = false;
    mockedAcquire.mockImplementation(async () => {
      if (held) return null;
      held = true;
      return 'lock-token-1';
    });
    mockedRelease.mockImplementation(async () => {
      held = false;
    });

    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        slot: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'slot_1',
            status: SlotStatus.AVAILABLE,
            price: 3500,
            bookings: [],
          }),
          update: jest.fn(),
        },
        booking: {
          create: jest.fn().mockResolvedValue({
            id: 'booking_1',
            userId: 'user_a',
            slotId: 'slot_1',
            status: BookingStatus.PENDING,
            totalAmount: 3500,
            paymentStatus: PaymentStatus.PENDING,
            paymentIntentId: null,
            qrCode: 'qr',
            createdAt: new Date(),
            cancelledAt: null,
          }),
        },
        waitlist: { deleteMany: jest.fn() },
      };
      return fn(tx);
    });

    mockedPrisma.booking.update.mockResolvedValue({
      id: 'booking_1',
      userId: 'user_a',
      slotId: 'slot_1',
      status: BookingStatus.CONFIRMED,
      totalAmount: 3500,
      paymentStatus: PaymentStatus.PAID,
      paymentIntentId: 'mock_pi_1',
      qrCode: 'qr',
      createdAt: new Date(),
      cancelledAt: null,
      slot: null,
    });

    const [a, b] = await Promise.allSettled([
      createBooking({ userId: 'user_a', slotId: 'slot_1' }),
      createBooking({ userId: 'user_b', slotId: 'slot_1' }),
    ]);

    const fulfilled = [a, b].filter((r) => r.status === 'fulfilled');
    const rejected = [a, b].filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'SLOT_LOCKED',
    });
    expect(mockedRelease).toHaveBeenCalled();
  });
});
