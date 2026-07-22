import { Router } from 'express';
import { z } from 'zod';
import { BookingSource, BookingStatus, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError, sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import { assertCanManageBranch } from '../services/access.service';
import * as bookingService from '../services/booking.service';
import { resolvePrice } from '../pricing/resolvePrice';
import { subscribeBranchSlots } from '../lib/slotEvents';

export const walkinRouter = Router();

walkinRouter.use(authenticate);
walkinRouter.use(
  requireRoles(UserRole.FRONT_DESK, UserRole.BRANCH_MANAGER, UserRole.COMPANY_OWNER, UserRole.ADMIN),
);

/** Today's slot grid for a branch (courts × times). */
walkinRouter.get('/branches/:branchId/grid', async (req, res, next) => {
  try {
    const branchId = param(req, 'branchId');
    await assertCanManageBranch(req.user!, branchId);
    const dateStr =
      typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : new Date().toISOString().slice(0, 10);
    const date = new Date(`${dateStr}T00:00:00.000Z`);

    const courts = await prisma.court.findMany({
      where: { branchId },
      include: { sport: true },
      orderBy: { name: 'asc' },
    });

    const slots = await prisma.slot.findMany({
      where: { courtId: { in: courts.map((c) => c.id) }, date },
      include: {
        bookings: {
          where: { status: { not: BookingStatus.CANCELLED } },
          take: 1,
          select: {
            id: true,
            bookingSource: true,
            guestName: true,
            user: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: [{ startTime: 'asc' }],
    });

    sendSuccess(res, {
      date: dateStr,
      courts: courts.map((c) => ({
        id: c.id,
        name: c.name,
        sport: c.sport,
        pricePerHour: Number(c.pricePerHour),
      })),
      slots: slots.map((s) => {
        const active = s.bookings[0];
        return {
          id: s.id,
          courtId: s.courtId,
          date: dateStr,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status,
          price: Number(s.price),
          booking: active
            ? {
                id: active.id,
                source: active.bookingSource,
                customerName: active.guestName ?? active.user.name,
                customerPhone: active.user.phone,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

/** SSE live slot updates for a branch. */
walkinRouter.get('/branches/:branchId/events', async (req, res, next) => {
  try {
    const branchId = param(req, 'branchId');
    await assertCanManageBranch(req.user!, branchId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`event: ready\ndata: ${JSON.stringify({ branchId })}\n\n`);

    const unsubscribe = subscribeBranchSlots(branchId, (event) => {
      res.write(`event: slot\ndata: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (error) {
    next(error);
  }
});

walkinRouter.post(
  '/bookings',
  validate(
    z.object({
      slotId: z.string().min(1),
      customerName: z.string().min(1).max(120).optional(),
      customerPhone: z.string().min(5).max(32).optional(),
      paymentMethod: z
        .enum(['CASH', 'JAZZCASH', 'EASYPAISA', 'CARD', 'WALLET'])
        .default('CASH'),
    }),
  ),
  async (req, res, next) => {
    try {
      const slot = await prisma.slot.findUnique({
        where: { id: req.body.slotId },
        include: { court: true },
      });
      if (!slot) {
        throw new AppError('Slot not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      await assertCanManageBranch(req.user!, slot.court.branchId);

      const booking = await bookingService.createBooking({
        slotId: req.body.slotId,
        walkInCustomer: {
          name: req.body.customerName ?? 'Walk-in Guest',
          phone: req.body.customerPhone,
        },
        source: BookingSource.WALK_IN,
        paymentMethod: req.body.paymentMethod,
        createdByStaffId: req.user!.id,
      });
      sendSuccess(res, booking, 201);
    } catch (error) {
      next(error);
    }
  },
);

walkinRouter.get('/branches/:branchId/branding', async (req, res, next) => {
  try {
    const branchId = param(req, 'branchId');
    await assertCanManageBranch(req.user!, branchId);
    const branch = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      include: {
        company: {
          include: { branding: true },
        },
      },
    });
    sendSuccess(res, {
      branch: { id: branch.id, name: branch.name },
      company: { id: branch.company.id, name: branch.company.name },
      branding: branch.company.branding ?? {
        logoUrl: branch.company.logoUrl,
        primaryColor: '#00A651',
        secondaryColor: '#0B1F3A',
        businessName: branch.company.name,
        receiptFooterText: null,
      },
    });
  } catch (error) {
    next(error);
  }
});

walkinRouter.get('/branches/:branchId/day-summary', async (req, res, next) => {
  try {
    const branchId = param(req, 'branchId');
    await assertCanManageBranch(req.user!, branchId);
    const dateStr =
      typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : new Date().toISOString().slice(0, 10);
    const date = new Date(`${dateStr}T00:00:00.000Z`);

    const bookings = await prisma.booking.findMany({
      where: {
        bookingSource: BookingSource.WALK_IN,
        status: { not: BookingStatus.CANCELLED },
        slot: { date, court: { branchId } },
      },
      select: { totalAmount: true, paymentMethod: true },
    });

    const byMethod: Record<string, { count: number; revenue: number }> = {};
    let revenue = 0;
    for (const b of bookings) {
      const method = b.paymentMethod ?? 'CASH';
      const amount = Number(b.totalAmount);
      revenue += amount;
      byMethod[method] ??= { count: 0, revenue: 0 };
      byMethod[method].count += 1;
      byMethod[method].revenue += amount;
    }

    sendSuccess(res, {
      date: dateStr,
      walkInCount: bookings.length,
      revenue,
      byPaymentMethod: byMethod,
    });
  } catch (error) {
    next(error);
  }
});

/** Preview walk-in price for a slot before confirm. */
walkinRouter.get('/slots/:slotId/price', async (req, res, next) => {
  try {
    const slot = await prisma.slot.findUnique({
      where: { id: param(req, 'slotId') },
      include: { court: true },
    });
    if (!slot) {
      throw new AppError('Slot not found', { statusCode: 404, code: 'NOT_FOUND' });
    }
    await assertCanManageBranch(req.user!, slot.court.branchId);
    sendSuccess(
      res,
      await resolvePrice(slot.courtId, slot.date, slot.startTime, 'WALK_IN'),
    );
  } catch (error) {
    next(error);
  }
});
