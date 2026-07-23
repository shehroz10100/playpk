import { z } from 'zod';
import { Router } from 'express';
import { SlotStatus, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError, sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import { assertCanManageBranch } from '../services/access.service';
import * as slotService from '../services/slot.service';
import { getPaymentInfoForSlot } from '../services/booking.service';

export const slotsRouter = Router();

const generateSchema = z.object({
  courtId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  openTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  durationMinutes: z.number().int().positive().optional(),
  priceOverride: z.number().positive().optional(),
});

slotsRouter.post(
  '/generate',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  validate(generateSchema),
  async (req, res, next) => {
    try {
      const court = await prisma.court.findUnique({ where: { id: req.body.courtId } });
      if (!court) {
        throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      await assertCanManageBranch(req.user!, court.branchId);
      const result = await slotService.generateSlots(req.body);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  },
);

/** Create one slot with custom start/end times for the selected court + date. */
slotsRouter.post(
  '/',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  validate(
    z.object({
      courtId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/)
        .transform((t) => t.slice(0, 5)),
      endTime: z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/)
        .transform((t) => t.slice(0, 5)),
      price: z.number().positive().optional(),
      status: z.nativeEnum(SlotStatus).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const court = await prisma.court.findUnique({ where: { id: req.body.courtId } });
      if (!court) {
        throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      await assertCanManageBranch(req.user!, court.branchId);
      const slot = await slotService.createManualSlot(req.body);
      sendSuccess(res, slot, 201);
    } catch (error) {
      next(error);
    }
  },
);

slotsRouter.get('/search', async (req, res, next) => {
  try {
    const q = z
      .object({
        city: z.string().optional(),
        sportId: z.string().optional(),
        sport: z.string().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        minPrice: z.coerce.number().optional(),
        maxPrice: z.coerce.number().optional(),
        minRating: z.coerce.number().min(1).max(5).optional(),
        page: z.coerce.number().int().positive().default(1),
        pageSize: z.coerce.number().int().positive().max(100).default(20),
      })
      .parse(req.query);

    const result = await slotService.searchSlots(q);
    sendSuccess(res, result.data, 200, result.meta);
  } catch (error) {
    next(error);
  }
});

/** Company bank details for checkout advance — lives under /slots to avoid /bookings/:id shadowing. */
slotsRouter.get('/:slotId/payment-info', authenticate, async (req, res, next) => {
  try {
    sendSuccess(res, await getPaymentInfoForSlot(param(req, 'slotId')));
  } catch (error) {
    next(error);
  }
});

/** Public player endpoint: slots for a court on a date (or next N days). */
slotsRouter.get('/court/:courtId/availability', async (req, res, next) => {
  try {
    const court = await prisma.court.findUnique({
      where: { id: param(req, 'courtId') },
      include: { sport: true, branch: { select: { id: true, name: true, city: true } } },
    });
    if (!court) {
      throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
    }

    const q = z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        days: z.coerce.number().int().positive().max(14).default(7),
      })
      .parse(req.query);

    const start = q.date ? new Date(`${q.date}T00:00:00.000Z`) : new Date();
    const startUtc = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    );
    const endUtc = new Date(startUtc);
    endUtc.setUTCDate(endUtc.getUTCDate() + q.days - 1);

    const slots = await prisma.slot.findMany({
      where: {
        courtId: court.id,
        date: { gte: startUtc, lte: endUtc },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        price: true,
      },
    });

    sendSuccess(res, {
      court: {
        id: court.id,
        name: court.name,
        pricePerHour: Number(court.pricePerHour),
        indoor: court.indoor,
        hasAC: court.hasAC,
        photos: court.photos,
        sport: court.sport,
        branch: court.branch,
      },
      slots: slots.map((s) => ({
        ...s,
        price: Number(s.price),
        date: s.date.toISOString().slice(0, 10),
      })),
    });
  } catch (error) {
    next(error);
  }
});

slotsRouter.get(
  '/court/:courtId',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const court = await prisma.court.findUnique({ where: { id: param(req, 'courtId') } });
      if (!court) {
        throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      await assertCanManageBranch(req.user!, court.branchId);
      const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.date);
      const slots = await slotService.listSlotsForCourtDate(court.id, date);
      sendSuccess(res, slots);
    } catch (error) {
      next(error);
    }
  },
);

slotsRouter.patch(
  '/:slotId',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  validate(
    z.object({
      status: z.nativeEnum(SlotStatus).optional(),
      price: z.number().positive().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const slot = await prisma.slot.findUnique({
        where: { id: param(req, 'slotId') },
        include: { court: true },
      });
      if (!slot) {
        throw new AppError('Slot not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      await assertCanManageBranch(req.user!, slot.court.branchId);
      const updated = await slotService.updateSlotStatus(
        slot.id,
        req.body.status ?? slot.status,
        req.body.price,
      );
      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  },
);

slotsRouter.post(
  '/holiday',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  validate(
    z.object({
      courtId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  ),
  async (req, res, next) => {
    try {
      const court = await prisma.court.findUnique({ where: { id: req.body.courtId } });
      if (!court) {
        throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      await assertCanManageBranch(req.user!, court.branchId);
      const result = await slotService.markHoliday(req.body.courtId, req.body.date);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },
);
