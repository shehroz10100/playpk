import { z } from 'zod';
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { BookingStatus, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError, sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import * as bookingService from '../services/booking.service';
import { getStorageProvider } from '../services/storage/LocalDiskStorageProvider';
import { assertCanManageBranch } from '../services/access.service';

export const bookingsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

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

bookingsRouter.get('/payment-info', authenticate, async (req, res, next) => {
  try {
    const slotId = typeof req.query.slotId === 'string' ? req.query.slotId : '';
    if (!slotId) {
      throw new AppError('slotId is required', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    sendSuccess(res, await bookingService.getPaymentInfoForSlot(slotId));
  } catch (error) {
    next(error);
  }
});

bookingsRouter.post(
  '/payment-proof',
  authenticate,
  upload.single('proof'),
  async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) {
        throw new AppError('No screenshot uploaded', { statusCode: 400, code: 'VALIDATION_ERROR' });
      }
      if (!file.mimetype.startsWith('image/')) {
        throw new AppError('Payment proof must be an image', {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }
      const storage = getStorageProvider();
      const ext = file.mimetype.split('/')[1] ?? 'jpg';
      const key = `payment-proofs/${req.user!.id}/${randomUUID()}.${ext}`;
      const stored = await storage.putObject({
        key,
        body: file.buffer,
        contentType: file.mimetype,
      });
      sendSuccess(res, { url: stored.url }, 201);
    } catch (error) {
      next(error);
    }
  },
);

bookingsRouter.post(
  '/',
  authenticate,
  validate(
    z.object({
      slotId: z.string().min(1),
      paymentMethod: z
        .enum(['mock', 'wallet', 'jazzcash', 'easypaisa', 'card', 'bank_transfer'])
        .optional(),
      paymentProofUrl: z.string().min(1).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const booking = await bookingService.createBooking({
        userId: req.user!.id,
        slotId: req.body.slotId,
        paymentMethod: req.body.paymentMethod,
        paymentProofUrl: req.body.paymentProofUrl,
      });
      sendSuccess(res, booking, 201);
    } catch (error) {
      next(error);
    }
  },
);

bookingsRouter.post(
  '/:bookingId/verify-payment',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: param(req, 'bookingId') },
        include: { slot: { include: { court: true } } },
      });
      if (!booking) {
        throw new AppError('Booking not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      await assertCanManageBranch(req.user!, booking.slot.court.branchId);
      sendSuccess(res, await bookingService.verifyBookingPayment(booking.id));
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
