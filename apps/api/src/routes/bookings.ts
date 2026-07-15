import { z } from 'zod';
import { Router } from 'express';
import { BookingStatus, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError, sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import * as bookingService from '../services/booking.service';

export const bookingsRouter = Router();

bookingsRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user!.id },
      include: {
        slot: {
          include: {
            court: {
              include: {
                sport: true,
                branch: { select: { id: true, name: true, city: true, address: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const serialized = bookings.map((b) => bookingService.serializeBooking(b));
    const upcoming = serialized.filter((b) => {
      if (b.status === BookingStatus.CANCELLED) return false;
      if (!b.slot?.date) return false;
      return new Date(b.slot.date) >= todayUtc;
    });
    const past = serialized.filter((b) => !upcoming.includes(b));

    sendSuccess(res, { upcoming, past, all: serialized });
  } catch (error) {
    next(error);
  }
});

bookingsRouter.get('/:bookingId', authenticate, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: param(req, 'bookingId') },
      include: {
        slot: {
          include: {
            court: {
              include: {
                sport: true,
                branch: { select: { id: true, name: true, city: true, address: true } },
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new AppError('Booking not found', { statusCode: 404, code: 'NOT_FOUND' });
    }

    const staffRoles: UserRole[] = [
      UserRole.COMPANY_OWNER,
      UserRole.BRANCH_MANAGER,
      UserRole.ADMIN,
    ];
    if (booking.userId !== req.user!.id && !staffRoles.includes(req.user!.role)) {
      throw new AppError('Forbidden', { statusCode: 403, code: 'FORBIDDEN' });
    }

    sendSuccess(res, bookingService.serializeBooking(booking));
  } catch (error) {
    next(error);
  }
});

bookingsRouter.post(
  '/',
  authenticate,
  validate(
    z.object({
      slotId: z.string().min(1),
      paymentMethod: z.enum(['mock', 'wallet', 'jazzcash', 'easypaisa', 'card']).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const booking = await bookingService.createBooking({
        userId: req.user!.id,
        slotId: req.body.slotId,
        paymentMethod: req.body.paymentMethod,
      });
      sendSuccess(res, booking, 201);
    } catch (error) {
      next(error);
    }
  },
);

bookingsRouter.post('/:bookingId/cancel', authenticate, async (req, res, next) => {
  try {
    const staffRoles: UserRole[] = [
      UserRole.COMPANY_OWNER,
      UserRole.BRANCH_MANAGER,
      UserRole.ADMIN,
    ];
    const isStaff = staffRoles.includes(req.user!.role);
    const result = await bookingService.cancelBooking({
      bookingId: param(req, 'bookingId'),
      userId: req.user!.id,
      isStaff,
    });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

bookingsRouter.post(
  '/:bookingId/complete',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const booking = await bookingService.completeBooking({
        bookingId: param(req, 'bookingId'),
        userId: req.user!.id,
        isStaff: true,
      });
      sendSuccess(res, booking);
    } catch (error) {
      next(error);
    }
  },
);

bookingsRouter.get(
  '/:bookingId/refund-status',
  authenticate,
  requireRoles(UserRole.PLAYER, UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const result = await bookingService.getRefundStatus(param(req, 'bookingId'));
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },
);
