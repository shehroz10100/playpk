import {
  BookingStatus,
  PaymentStatus,
  SlotStatus,
  type Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { acquireSlotLock, releaseSlotLock } from '../lib/slotLock';
import { getPaymentProvider } from './payments/MockPaymentProvider';
import { awardLoyaltyForBooking } from './loyalty.service';
import { creditWalletRefund, debitWallet } from './wallet.service';
import { promoteNextWaitlistedUser } from './waitlist.service';
import { notifyUser } from './notify.service';
import { BOOKING_ADVANCE_PKR } from '@playpk/shared-types';

/**
 * Create a booking with Redis slot-locking to prevent double-booking under concurrency.
 *
 * Flow:
 * 1. Acquire short-lived Redis lock for the slot
 * 2. Re-check slot is AVAILABLE inside a transaction
 * 3. Create booking + mark slot BOOKED (+ wallet debit if needed)
 * 4. Charge via PaymentProvider (mock) unless wallet already paid
 * 5. Award loyalty points
 * 6. Always release the Redis lock in finally
 */
export async function createBooking(input: {
  userId: string;
  slotId: string;
  paymentMethod?: 'mock' | 'wallet' | 'jazzcash' | 'easypaisa' | 'card' | 'bank_transfer';
  paymentProofUrl?: string;
}) {
  const method = input.paymentMethod ?? 'mock';
  const bankMethods = new Set(['jazzcash', 'easypaisa', 'bank_transfer', 'card']);
  if (bankMethods.has(method) && !input.paymentProofUrl) {
    throw new AppError('Upload a payment screenshot for bank / wallet transfer advance.', {
      statusCode: 400,
      code: 'PAYMENT_PROOF_REQUIRED',
    });
  }

  const lockToken = await acquireSlotLock(input.slotId);
  if (!lockToken) {
    throw new AppError('Slot is being booked by another user. Try again.', {
      statusCode: 409,
      code: 'SLOT_LOCKED',
    });
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const slot = await tx.slot.findUnique({
        where: { id: input.slotId },
        include: {
          bookings: {
            where: { status: { not: BookingStatus.CANCELLED } },
            take: 1,
          },
        },
      });

      if (!slot) {
        throw new AppError('Slot not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      if (slot.status !== SlotStatus.AVAILABLE || slot.bookings.length > 0) {
        throw new AppError('Slot is not available', {
          statusCode: 409,
          code: 'SLOT_UNAVAILABLE',
        });
      }

      const advanceAmount = BOOKING_ADVANCE_PKR;

      const created = await tx.booking.create({
        data: {
          userId: input.userId,
          slotId: slot.id,
          status: BookingStatus.PENDING,
          totalAmount: advanceAmount,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: method,
          paymentProofUrl: input.paymentProofUrl,
          paymentProofUploadedAt: input.paymentProofUrl ? new Date() : null,
          qrCode: `playpk://booking/${randomUUID()}`,
        },
      });

      await tx.slot.update({
        where: { id: slot.id },
        data: { status: SlotStatus.BOOKED },
      });

      if (method === 'wallet') {
        await debitWallet(tx, {
          userId: input.userId,
          amount: advanceAmount,
          bookingId: created.id,
        });
      }

      await tx.waitlist.deleteMany({
        where: { userId: input.userId, slotId: slot.id },
      });

      return created;
    });

    let paymentIntentId: string | null = null;
    const awaitsProof = bankMethods.has(method);

    if (method === 'wallet') {
      paymentIntentId = `wallet_${booking.id}`;
    } else if (!awaitsProof) {
      const payment = getPaymentProvider();
      const intent = await payment.createPaymentIntent({
        amount: Number(booking.totalAmount),
        currency: 'PKR',
        bookingId: booking.id,
        userId: input.userId,
        method: method === 'bank_transfer' ? 'card' : method,
      });
      paymentIntentId = intent.id;
    } else {
      paymentIntentId = `proof_${booking.id}`;
    }

    const confirmed = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CONFIRMED,
        // Bank transfer with screenshot awaits company/admin verification
        paymentStatus: awaitsProof ? PaymentStatus.PENDING : PaymentStatus.PAID,
        paymentIntentId,
      },
      include: {
        slot: {
          include: {
            court: {
              include: {
                branch: { include: { company: true } },
                sport: true,
              },
            },
          },
        },
      },
    });

    if (!awaitsProof) {
      await awardLoyaltyForBooking(prisma, {
        userId: input.userId,
        bookingId: confirmed.id,
        amount: Number(confirmed.totalAmount),
      });
    }

    await notifyBranchStaffOfNewBooking(confirmed.id);

    return serializeBooking(confirmed);
  } finally {
    await releaseSlotLock(input.slotId, lockToken);
  }
}

export async function getPaymentInfoForSlot(slotId: string) {
  const slot = await prisma.slot.findUnique({
    where: { id: slotId },
    include: {
      court: {
        include: {
          branch: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  bankAccountName: true,
                  bankAccountNumber: true,
                  bankName: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!slot) {
    throw new AppError('Slot not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  const company = slot.court.branch.company;
  return {
    advanceAmount: BOOKING_ADVANCE_PKR,
    company: {
      id: company.id,
      name: company.name,
      bankAccountName: company.bankAccountName,
      bankAccountNumber: company.bankAccountNumber,
      bankName: company.bankName,
    },
    branch: {
      id: slot.court.branch.id,
      name: slot.court.branch.name,
      city: slot.court.branch.city,
    },
    court: { id: slot.court.id, name: slot.court.name },
  };
}

export async function verifyBookingPayment(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new AppError('Booking not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { paymentStatus: PaymentStatus.PAID },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      slot: {
        include: {
          court: {
            include: {
              sport: true,
              branch: { select: { id: true, name: true, city: true, address: true, companyId: true } },
            },
          },
        },
      },
    },
  });
  if (booking.paymentStatus !== PaymentStatus.PAID) {
    await awardLoyaltyForBooking(prisma, {
      userId: updated.userId,
      bookingId: updated.id,
      amount: Number(updated.totalAmount),
    });
  }
  return serializeBooking(updated);
}

export async function cancelBooking(input: { bookingId: string; userId: string; isStaff: boolean }) {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { slot: true },
  });

  if (!booking) {
    throw new AppError('Booking not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (!input.isStaff && booking.userId !== input.userId) {
    throw new AppError('Forbidden', { statusCode: 403, code: 'FORBIDDEN' });
  }
  if (booking.status === BookingStatus.CANCELLED) {
    throw new AppError('Booking already cancelled', { statusCode: 409, code: 'ALREADY_CANCELLED' });
  }

  let refundStatus: 'pending' | 'succeeded' | 'failed' | 'not_applicable' = 'not_applicable';
  const wasWallet = booking.paymentIntentId?.startsWith('wallet_');

  if (booking.paymentStatus === PaymentStatus.PAID) {
    if (wasWallet) {
      await creditWalletRefund(prisma, {
        userId: booking.userId,
        amount: Number(booking.totalAmount),
        bookingId: booking.id,
      });
      refundStatus = 'succeeded';
    } else if (booking.paymentIntentId) {
      const refund = await getPaymentProvider().refund({
        paymentIntentId: booking.paymentIntentId,
        amount: Number(booking.totalAmount),
        reason: 'booking_cancelled',
      });
      refundStatus = refund.status;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        paymentStatus:
          refundStatus === 'succeeded'
            ? PaymentStatus.REFUNDED
            : refundStatus === 'pending'
              ? PaymentStatus.PARTIALLY_REFUNDED
              : booking.paymentStatus,
      },
      include: {
        slot: { include: { court: { include: { branch: true, sport: true } } } },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (booking.slot.status === SlotStatus.BOOKED) {
      await tx.slot.update({
        where: { id: booking.slotId },
        data: { status: SlotStatus.AVAILABLE },
      });
    }

    return cancelled;
  });

  // Auto-offer/confirm next waitlisted player for this slot
  const waitlistPromotion = await promoteNextWaitlistedUser(booking.slotId);

  return {
    booking: serializeBooking(updated),
    refundStatus,
    waitlistPromotion,
  };
}

export async function completeBooking(input: { bookingId: string; userId: string; isStaff: boolean }) {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { slot: { include: { court: { include: { branch: true, sport: true } } } } },
  });
  if (!booking) {
    throw new AppError('Booking not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (!input.isStaff && booking.userId !== input.userId) {
    throw new AppError('Forbidden', { statusCode: 403, code: 'FORBIDDEN' });
  }
  if (booking.status !== BookingStatus.CONFIRMED) {
    throw new AppError('Only confirmed bookings can be completed', {
      statusCode: 409,
      code: 'INVALID_STATUS',
    });
  }

  const completed = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.COMPLETED },
    include: {
      slot: { include: { court: { include: { branch: true, sport: true } } } },
    },
  });

  // Ensure loyalty was awarded (idempotent)
  await awardLoyaltyForBooking(prisma, {
    userId: completed.userId,
    bookingId: completed.id,
    amount: Number(completed.totalAmount),
  });

  return serializeBooking(completed);
}

export async function getRefundStatus(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new AppError('Booking not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  if (!booking.paymentIntentId) {
    return {
      bookingId: booking.id,
      paymentStatus: booking.paymentStatus,
      refund: null,
    };
  }

  if (booking.paymentIntentId.startsWith('wallet_')) {
    return {
      bookingId: booking.id,
      paymentStatus: booking.paymentStatus,
      refund: {
        paymentIntentId: booking.paymentIntentId,
        status: booking.paymentStatus === PaymentStatus.REFUNDED ? 'refunded' : 'succeeded',
        amount: Number(booking.totalAmount),
      },
    };
  }

  const intent = await getPaymentProvider().getPaymentIntent(booking.paymentIntentId);
  return {
    bookingId: booking.id,
    paymentStatus: booking.paymentStatus,
    refund: {
      paymentIntentId: intent.id,
      status: intent.status,
      amount: intent.amount,
    },
  };
}

export function serializeBooking(booking: {
  id: string;
  userId: string;
  slotId: string;
  status: BookingStatus;
  totalAmount: Prisma.Decimal | number;
  paymentStatus: PaymentStatus;
  paymentIntentId?: string | null;
  paymentMethod?: string | null;
  paymentProofUrl?: string | null;
  paymentProofUploadedAt?: Date | null;
  qrCode?: string | null;
  createdAt: Date;
  cancelledAt?: Date | null;
  user?: { id: string; name: string; email: string | null; phone: string | null };
  slot?: {
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    price: Prisma.Decimal | number;
    status: SlotStatus;
    court?: {
      id: string;
      name: string;
      branchId: string;
      sport?: unknown;
      branch?: {
        id: string;
        name: string;
        city: string;
        companyId?: string;
        address?: string;
        company?: {
          id: string;
          name: string;
          bankAccountName?: string | null;
          bankAccountNumber?: string | null;
          bankName?: string | null;
        };
      };
    };
  } | null;
}) {
  return {
    id: booking.id,
    userId: booking.userId,
    slotId: booking.slotId,
    status: booking.status,
    totalAmount: Number(booking.totalAmount),
    paymentStatus: booking.paymentStatus,
    paymentIntentId: booking.paymentIntentId ?? null,
    paymentMethod: booking.paymentMethod ?? null,
    paymentProofUrl: booking.paymentProofUrl ?? null,
    paymentProofUploadedAt: booking.paymentProofUploadedAt ?? null,
    qrCode: booking.qrCode ?? null,
    createdAt: booking.createdAt,
    cancelledAt: booking.cancelledAt ?? null,
    user: booking.user,
    slot: booking.slot
      ? {
          id: booking.slot.id,
          date: booking.slot.date,
          startTime: booking.slot.startTime,
          endTime: booking.slot.endTime,
          price: Number(booking.slot.price),
          status: booking.slot.status,
          court: booking.slot.court
            ? {
                id: booking.slot.court.id,
                name: booking.slot.court.name,
                branchId: booking.slot.court.branchId,
                sport: booking.slot.court.sport,
                branch: booking.slot.court.branch
                  ? {
                      id: booking.slot.court.branch.id,
                      name: booking.slot.court.branch.name,
                      city: booking.slot.court.branch.city,
                      companyId: booking.slot.court.branch.companyId,
                      address: booking.slot.court.branch.address,
                      company: booking.slot.court.branch.company,
                    }
                  : undefined,
              }
            : undefined,
        }
      : undefined,
  };
}

/** Push an in-app notification to company owner + branch manager when a customer books. */
export async function notifyBranchStaffOfNewBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      slot: {
        include: {
          court: {
            include: {
              sport: true,
              branch: {
                include: {
                  company: { select: { id: true, ownerId: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!booking?.slot?.court?.branch) return;

  const branch = booking.slot.court.branch;
  const recipientIds = new Set<string>([branch.company.ownerId]);
  if (branch.managerId) recipientIds.add(branch.managerId);

  const date = new Date(booking.slot.date).toISOString().slice(0, 10);
  const title = 'New booking';
  const body = `${booking.user.name} booked ${booking.slot.court.name} (${booking.slot.court.sport.name}) · ${date} ${booking.slot.startTime}–${booking.slot.endTime} · Booking ID ${booking.id}`;

  await Promise.all(
    [...recipientIds].map((userId) =>
      notifyUser(prisma, {
        userId,
        title,
        body,
        meta: {
          type: 'BOOKING_CREATED',
          bookingId: booking.id,
          branchId: branch.id,
          companyId: branch.company.id,
          courtId: booking.slot.court.id,
          amount: Number(booking.totalAmount),
        },
      }),
    ),
  );
}
