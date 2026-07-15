import { BookingStatus, SlotStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { notifyUser } from './notify.service';

export async function joinWaitlist(input: { userId: string; slotId: string }) {
  const slot = await prisma.slot.findUnique({
    where: { id: input.slotId },
    include: {
      bookings: {
        where: { status: { not: BookingStatus.CANCELLED } },
        take: 1,
      },
      court: { include: { branch: true } },
    },
  });
  if (!slot) {
    throw new AppError('Slot not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (slot.status === SlotStatus.AVAILABLE && slot.bookings.length === 0) {
    throw new AppError('Slot is still available — book it directly', {
      statusCode: 409,
      code: 'SLOT_AVAILABLE',
    });
  }
  if (slot.status !== SlotStatus.BOOKED) {
    throw new AppError('Only fully booked slots can be waitlisted', {
      statusCode: 409,
      code: 'SLOT_NOT_BOOKABLE',
    });
  }

  const existing = await prisma.waitlist.findUnique({
    where: { userId_slotId: { userId: input.userId, slotId: input.slotId } },
  });
  if (existing) {
    const position = await prisma.waitlist.count({
      where: { slotId: input.slotId, createdAt: { lte: existing.createdAt } },
    });
    return { entry: existing, alreadyJoined: true, position };
  }

  const entry = await prisma.waitlist.create({
    data: { userId: input.userId, slotId: input.slotId },
  });

  const position = await prisma.waitlist.count({
    where: { slotId: input.slotId, createdAt: { lte: entry.createdAt } },
  });

  return {
    entry,
    alreadyJoined: false,
    position,
    venue: slot.court.branch.name,
    court: slot.court.name,
  };
}

/**
 * When a booking cancels, offer the freed slot to the oldest waitlisted user
 * by auto-confirming a booking (mock payment) and notifying them.
 */
export async function promoteNextWaitlistedUser(slotId: string) {
  const next = await prisma.waitlist.findFirst({
    where: { slotId },
    orderBy: { createdAt: 'asc' },
    include: { user: true, slot: { include: { court: { include: { branch: true } } } } },
  });

  if (!next) {
    return null;
  }

  await prisma.waitlist.delete({ where: { id: next.id } });

  // Dynamic import avoids circular dependency with booking.service
  const { createBooking } = await import('./booking.service');

  try {
    const booking = await createBooking({
      userId: next.userId,
      slotId,
      paymentMethod: 'mock',
    });

    await notifyUser(prisma, {
      userId: next.userId,
      title: 'Waitlist slot confirmed',
      body: `A spot opened at ${next.slot.court.branch.name} (${next.slot.court.name}) on ${String(next.slot.date).slice(0, 10)} ${next.slot.startTime}. Your booking is confirmed.`,
      meta: { slotId, bookingId: booking.id, type: 'WAITLIST_PROMOTED' },
    });

    return {
      promotedUserId: next.userId,
      bookingId: booking.id,
      notified: true,
    };
  } catch (error) {
    await prisma.waitlist
      .create({
        data: { userId: next.userId, slotId },
      })
      .catch(() => undefined);

    await notifyUser(prisma, {
      userId: next.userId,
      title: 'Waitlist spot available',
      body: `A spot opened for ${next.slot.court.name}. Open the app and book quickly — auto-confirm failed.`,
      meta: { slotId, type: 'WAITLIST_OFFER' },
    });

    return {
      promotedUserId: next.userId,
      bookingId: null,
      notified: true,
      error: error instanceof Error ? error.message : 'auto_book_failed',
    };
  }
}

export async function listWaitlistForBranch(branchId: string) {
  return prisma.waitlist.findMany({
    where: { slot: { court: { branchId } } },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      slot: {
        include: {
          court: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}
