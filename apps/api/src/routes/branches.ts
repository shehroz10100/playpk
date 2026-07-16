import { z } from 'zod';
import { Router } from 'express';
import { BookingStatus, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError, sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import { assertCanManageBranch } from '../services/access.service';
import { invalidateVenueListCache } from '../lib/cache-invalidate';

export const branchesRouter = Router();

branchesRouter.use(authenticate);

branchesRouter.get('/:branchId', async (req, res, next) => {
  try {
    await assertCanManageBranch(req.user!, param(req, 'branchId'));
    const branch = await prisma.branch.findUnique({
      where: { id: param(req, 'branchId') },
      include: {
        courts: { include: { sport: true }, orderBy: { name: 'asc' } },
        company: { select: { id: true, name: true, ownerId: true } },
      },
    });
    if (!branch) {
      throw new AppError('Branch not found', { statusCode: 404, code: 'NOT_FOUND' });
    }
    sendSuccess(res, branch);
  } catch (error) {
    next(error);
  }
});

branchesRouter.patch(
  '/:branchId',
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  validate(
    z.object({
      name: z.string().min(2).optional(),
      city: z.string().min(2).optional(),
      address: z.string().min(5).optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      operatingHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      operatingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      managerId: z.string().nullable().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      await assertCanManageBranch(req.user!, param(req, 'branchId'));
      const branch = await prisma.branch.update({
        where: { id: param(req, 'branchId') },
        data: req.body,
      });
      await invalidateVenueListCache();
      sendSuccess(res, branch);
    } catch (error) {
      next(error);
    }
  },
);

branchesRouter.get('/:branchId/sports', async (req, res, next) => {
  try {
    await assertCanManageBranch(req.user!, param(req, 'branchId'));
    const courts = await prisma.court.findMany({
      where: { branchId: param(req, 'branchId') },
      select: { sport: true },
      distinct: ['sportId'],
    });
    sendSuccess(
      res,
      courts.map((c) => c.sport),
    );
  } catch (error) {
    next(error);
  }
});

branchesRouter.get('/:branchId/bookings', async (req, res, next) => {
  try {
    await assertCanManageBranch(req.user!, param(req, 'branchId'));
    const status = req.query.status as BookingStatus | undefined;
    const date = req.query.date as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));

    const where = {
      slot: {
        court: { branchId: param(req, 'branchId') },
        ...(date ? { date: new Date(`${date}T00:00:00.000Z`) } : {}),
      },
      ...(status ? { status } : {}),
    };

    const [total, bookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          slot: {
            include: {
              court: { include: { sport: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    sendSuccess(
      res,
      bookings.map((b) => ({
        id: b.id,
        status: b.status,
        totalAmount: Number(b.totalAmount),
        paymentStatus: b.paymentStatus,
        createdAt: b.createdAt,
        cancelledAt: b.cancelledAt,
        user: b.user,
        slot: {
          id: b.slot.id,
          date: b.slot.date,
          startTime: b.slot.startTime,
          endTime: b.slot.endTime,
          court: b.slot.court,
        },
      })),
      200,
      { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
    );
  } catch (error) {
    next(error);
  }
});

branchesRouter.get('/:branchId/stats/today', async (req, res, next) => {
  try {
    await assertCanManageBranch(req.user!, param(req, 'branchId'));
    const start = new Date();
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));

    const [totalSlots, bookedSlots, revenueAgg] = await Promise.all([
      prisma.slot.count({
        where: { court: { branchId: param(req, 'branchId') }, date },
      }),
      prisma.slot.count({
        where: {
          court: { branchId: param(req, 'branchId') },
          date,
          status: 'BOOKED',
        },
      }),
      prisma.booking.aggregate({
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
          slot: { court: { branchId: param(req, 'branchId') }, date },
        },
        _sum: { totalAmount: true },
      }),
    ]);

    const occupancyPercent =
      totalSlots === 0 ? 0 : Math.round((bookedSlots / totalSlots) * 1000) / 10;

    sendSuccess(res, {
      date: date.toISOString().slice(0, 10),
      totalSlots,
      bookedSlots,
      occupancyPercent,
      revenue: Number(revenueAgg._sum.totalAmount ?? 0),
      currency: 'PKR',
    });
  } catch (error) {
    next(error);
  }
});
