import {
  BookingSource,
  BookingStatus,
  PaymentStatus,
  SlotStatus,
  type Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { acquireSlotLock, releaseSlotLock } from '../lib/slotLock';
import { publishSlotStatusChanged } from '../lib/slotEvents';
import { getPaymentProvider } from './payments/MockPaymentProvider';
import { awardLoyaltyForBooking } from './loyalty.service';
import { creditWalletRefund, debitWallet } from './wallet.service';
import { promoteNextWaitlistedUser } from './waitlist.service';
import { notifyUser } from './notify.service';
import { resolvePrice } from '../pricing/resolvePrice';
import { resolveAdvanceAmount, resolveAdvanceTotal } from '../pricing/resolveAdvance';
import { resolveWalkInCustomer } from './walkin-customer.service';
import { mockPaymentsAllowed } from '../lib/security-flags';


export type CreateBookingPaymentMethod =
  | 'mock'
  | 'wallet'
  | 'jazzcash'
  | 'easypaisa'
  | 'card'
  | 'bank_transfer'
  | 'CASH'
  | 'JAZZCASH'
  | 'EASYPAISA'
  | 'CARD'
  | 'WALLET';

export type CreateBookingInput = {
  slotId: string;
  /** Registered player / guest user id. Optional when walkInCustomer is provided. */
  userId?: string;
  walkInCustomer?: { name?: string | null; phone?: string | null };
  source?: BookingSource | 'ONLINE' | 'WALK_IN' | 'PHONE';
  paymentMethod?: CreateBookingPaymentMethod;
  paymentProofUrl?: string;
  createdByStaffId?: string | null;
};

/**
 * Create a booking with Redis slot-locking to prevent double-booking under concurrency.
 * Used by BOTH online checkout and walk-in front-desk — do not duplicate this path.
 */
export async function createBooking(input: CreateBookingInput) {
  const source = (input.source ?? BookingSource.ONLINE) as BookingSource;
  const method = (input.paymentMethod ?? (source === BookingSource.WALK_IN ? 'CASH' : 'mock')) as string;
  const isWalkInChannel = source === BookingSource.WALK_IN || source === BookingSource.PHONE;

  // Instant "mock" success is free checkout — only allowed in local/demo.
  if (
    !isWalkInChannel &&
    (method === 'mock' || method === 'MOCK') &&
    !mockPaymentsAllowed()
  ) {
    throw new AppError(
      'Mock payment is disabled. Use wallet, bank transfer, JazzCash, or Easypaisa with proof.',
      { statusCode: 403, code: 'MOCK_PAYMENTS_DISABLED' },
    );
  }

  let userId = input.userId;
  let guestName: string | null = null;
  let guestPhone: string | null = null;
  if (!userId) {
    if (!isWalkInChannel || !input.walkInCustomer) {
      throw new AppError('userId is required for online bookings', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    const guest = await resolveWalkInCustomer(input.walkInCustomer);
    userId = guest.userId;
    guestName = guest.guestName;
    guestPhone = guest.guestPhone;
  } else if (input.walkInCustomer) {
    guestName = input.walkInCustomer.name?.trim() || null;
    guestPhone = input.walkInCustomer.phone?.trim() || null;
  }

  const bankMethods = new Set(['jazzcash', 'easypaisa', 'bank_transfer', 'card']);
  if (!isWalkInChannel && bankMethods.has(method) && !input.paymentProofUrl) {
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
          court: true,
          bookings: {
            where: { status: { not: BookingStatus.CANCELLED } },
            take: 1,
          },
        },
      });

      if (!slot) {
        throw new AppError('Slot not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      if (
        slot.status === SlotStatus.BLOCKED ||
        slot.status === SlotStatus.MAINTENANCE
      ) {
        throw new AppError('Slot is blocked or under maintenance', {
          statusCode: 409,
          code: 'SLOT_UNAVAILABLE',
        });
      }
      if (slot.status !== SlotStatus.AVAILABLE || slot.bookings.length > 0) {
        throw new AppError('Slot is not available', {
          statusCode: 409,
          code: 'SLOT_UNAVAILABLE',
        });
      }

      const resolved = await resolvePrice(
        slot.courtId,
        slot.date,
        slot.startTime,
        isWalkInChannel ? 'WALK_IN' : 'ONLINE',
      );

      // Online: flat advance per slot (discounted when a sport offer applies).
      // Customer pays remaining court price at the venue. Walk-in charges full price now.
      const chargeAmount = isWalkInChannel
        ? resolved.price
        : resolveAdvanceAmount();
      const paymentStatus = isWalkInChannel ? PaymentStatus.PAID : PaymentStatus.PENDING;
      const status = isWalkInChannel ? BookingStatus.CONFIRMED : BookingStatus.PENDING;

      const created = await tx.booking.create({
        data: {
          userId: userId!,
          slotId: slot.id,
          status,
          totalAmount: chargeAmount,
          paymentStatus,
          paymentMethod: method,
          paymentProofUrl: input.paymentProofUrl,
          paymentProofUploadedAt: input.paymentProofUrl ? new Date() : null,
          bookingSource: source,
          createdByStaffId: input.createdByStaffId ?? null,
          guestName,
          guestPhone,
          qrCode: `playpk://booking/${randomUUID()}`,
          ...(isWalkInChannel ? { paymentIntentId: `walkin_${randomUUID()}` } : {}),
        },
      });

      await tx.slot.update({
        where: { id: slot.id },
        data: { status: SlotStatus.BOOKED, price: resolved.price },
      });

      if (method === 'wallet' || method === 'WALLET') {
        await debitWallet(tx, {
          userId: userId!,
          amount: chargeAmount,
          bookingId: created.id,
        });
      }

      await tx.waitlist.deleteMany({
        where: { userId: userId!, slotId: slot.id },
      });

      return { created, branchId: slot.court.branchId, courtId: slot.courtId };
    });

    if (isWalkInChannel) {
      await publishSlotStatusChanged({
        slotId: input.slotId,
        branchId: booking.branchId,
        courtId: booking.courtId,
        status: SlotStatus.BOOKED,
        bookingSource: source,
      });

      const full = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.created.id },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
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
      await notifyBranchStaffOfNewBooking(full.id);
      return serializeBooking(full);
    }

    let paymentIntentId: string | null = null;
    const awaitsProof = bankMethods.has(method);

    if (method === 'wallet' || method === 'WALLET') {
      paymentIntentId = `wallet_${booking.created.id}`;
    } else if (!awaitsProof) {
      const payment = getPaymentProvider();
      const intent = await payment.createPaymentIntent({
        amount: Number(booking.created.totalAmount),
        currency: 'PKR',
        bookingId: booking.created.id,
        userId: userId!,
        method: method === 'bank_transfer' ? 'card' : (method as 'mock' | 'card' | 'jazzcash' | 'easypaisa'),
      });
      paymentIntentId = intent.id;
    } else {
      paymentIntentId = `proof_${booking.created.id}`;
    }

    const confirmed = await prisma.booking.update({
      where: { id: booking.created.id },
      data: {
        status: BookingStatus.CONFIRMED,
        paymentStatus: awaitsProof ? PaymentStatus.PENDING : PaymentStatus.PAID,
        paymentIntentId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
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
        userId: userId!,
        bookingId: confirmed.id,
        amount: Number(confirmed.totalAmount),
      });
    }

    await publishSlotStatusChanged({
      slotId: input.slotId,
      branchId: booking.branchId,
      courtId: booking.courtId,
      status: SlotStatus.BOOKED,
      bookingSource: source,
    });

    await notifyBranchStaffOfNewBooking(confirmed.id);

    return serializeBooking(confirmed);
  } finally {
    await releaseSlotLock(input.slotId, lockToken);
  }
}

export async function getPaymentInfoForSlot(slotId: string) {
  return getPaymentInfoForSlots([slotId]);
}

export async function getPaymentInfoForSlots(slotIds: string[]) {
  const uniqueIds = [...new Set(slotIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new AppError('slotId is required', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  const slots = await prisma.slot.findMany({
    where: { id: { in: uniqueIds } },
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

  if (slots.length !== uniqueIds.length) {
    throw new AppError('Slot not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const companyId = slots[0]!.court.branch.company.id;
  if (slots.some((s) => s.court.branch.company.id !== companyId)) {
    throw new AppError('All slots must belong to the same venue company', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  let listCourtTotal = 0;
  let discountedCourtTotal = 0;
  let discountPercent: number | null = null;
  for (const slot of slots) {
    const resolved = await resolvePrice(slot.courtId, slot.date, slot.startTime, 'ONLINE');
    listCourtTotal += resolved.basePrice;
    // Prefer resolved.price (includes pricing rules + sport discount) for venue remainder.
    discountedCourtTotal += resolved.price;
    if (resolved.discountPercent != null) {
      discountPercent = resolved.discountPercent;
    }
  }

  const amountDue = resolveAdvanceTotal(uniqueIds.length);
  const company = slots[0]!.court.branch.company;
  const branch = slots[0]!.court.branch;
  const court = slots[0]!.court;

  return {
    advanceAmount: amountDue,
    amountDue,
    /** List / company court total before sport discount */
    courtTotal: listCourtTotal,
    /** Court total after sport discount (used for pay-at-venue) */
    discountedCourtTotal,
    remainingAtVenue: Math.max(0, discountedCourtTotal - amountDue),
    discountPercent,
    slotCount: uniqueIds.length,
    company: {
      id: company.id,
      name: company.name,
      bankAccountName: company.bankAccountName,
      bankAccountNumber: company.bankAccountNumber,
      bankName: company.bankName,
    },
    branch: {
      id: branch.id,
      name: branch.name,
      city: branch.city,
    },
    court: { id: court.id, name: court.name },
  };
}

/**
 * Book one or more slots in one checkout.
 * Online charge = sum of per-slot advances (discounted when offers apply).
 */
export async function createBookings(input: {
  slotIds: string[];
  userId: string;
  paymentMethod?: CreateBookingPaymentMethod;
  paymentProofUrl?: string;
}) {
  const uniqueIds = [...new Set(input.slotIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new AppError('At least one slotId is required', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (uniqueIds.length === 1) {
    return createBooking({
      userId: input.userId,
      slotId: uniqueIds[0]!,
      paymentMethod: input.paymentMethod,
      paymentProofUrl: input.paymentProofUrl,
    });
  }

  const results = [];
  for (const slotId of uniqueIds) {
    results.push(
      await createBooking({
        userId: input.userId,
        slotId,
        paymentMethod: input.paymentMethod,
        paymentProofUrl: input.paymentProofUrl,
      }),
    );
  }
  return {
    ...results[0]!,
    bookings: results,
    ids: results.map((b) => b.id),
    totalAmount: results.reduce((sum, b) => sum + Number(b.totalAmount), 0),
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

  const court = await prisma.court.findUnique({
    where: { id: updated.slot.courtId },
    select: { id: true, branchId: true },
  });
  if (court) {
    await publishSlotStatusChanged({
      slotId: updated.slotId,
      branchId: court.branchId,
      courtId: court.id,
      status: SlotStatus.AVAILABLE,
      bookingSource: updated.bookingSource,
    });
  }

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
  bookingSource?: string | null;
  createdByStaffId?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
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
    bookingSource: booking.bookingSource ?? 'ONLINE',
    createdByStaffId: booking.createdByStaffId ?? null,
    guestName: booking.guestName ?? null,
    guestPhone: booking.guestPhone ?? null,
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
