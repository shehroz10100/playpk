import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError, sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import { assertCanManageCompany } from '../services/access.service';
import { cacheDel } from '../lib/cache';
import * as discounts from '../services/sport-discount.service';

export const sportDiscountsRouter = Router();

sportDiscountsRouter.use(authenticate);
sportDiscountsRouter.use(
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
);

const upsertBody = z.object({
  companyId: z.string().min(1),
  sportId: z.string().min(1),
  percentOff: z.number().min(1).max(90),
  label: z.string().max(80).nullable().optional(),
  active: z.boolean().optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validTo: z.string().datetime().nullable().optional(),
});

const patchBody = z.object({
  percentOff: z.number().min(1).max(90).optional(),
  label: z.string().max(80).nullable().optional(),
  active: z.boolean().optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validTo: z.string().datetime().nullable().optional(),
});

async function bustVenueCache() {
  await cacheDel('venues:list:*');
}

sportDiscountsRouter.get('/', async (req, res, next) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : '';
    if (!companyId) {
      throw new AppError('companyId is required', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    await assertCanManageCompany(req.user!, companyId);
    sendSuccess(res, await discounts.listSportDiscounts(companyId));
  } catch (error) {
    next(error);
  }
});

sportDiscountsRouter.post('/', validate(upsertBody), async (req, res, next) => {
  try {
    await assertCanManageCompany(req.user!, req.body.companyId);
    const row = await discounts.upsertSportDiscount({
      companyId: req.body.companyId,
      sportId: req.body.sportId,
      percentOff: req.body.percentOff,
      label: req.body.label,
      active: req.body.active,
      validFrom: req.body.validFrom ? new Date(req.body.validFrom) : req.body.validFrom,
      validTo: req.body.validTo ? new Date(req.body.validTo) : req.body.validTo,
    });
    await bustVenueCache();
    sendSuccess(res, row, 201);
  } catch (error) {
    next(error);
  }
});

sportDiscountsRouter.patch('/:id', validate(patchBody), async (req, res, next) => {
  try {
    const existing = await prisma.sportDiscount.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) {
      throw new AppError('Discount not found', { statusCode: 404, code: 'NOT_FOUND' });
    }
    await assertCanManageCompany(req.user!, existing.companyId);
    const row = await discounts.updateSportDiscount(existing.id, {
      percentOff: req.body.percentOff,
      label: req.body.label,
      active: req.body.active,
      validFrom:
        req.body.validFrom === undefined
          ? undefined
          : req.body.validFrom
            ? new Date(req.body.validFrom)
            : null,
      validTo:
        req.body.validTo === undefined
          ? undefined
          : req.body.validTo
            ? new Date(req.body.validTo)
            : null,
    });
    await bustVenueCache();
    sendSuccess(res, row);
  } catch (error) {
    next(error);
  }
});

sportDiscountsRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.sportDiscount.findUnique({ where: { id: param(req, 'id') } });
    if (!existing) {
      throw new AppError('Discount not found', { statusCode: 404, code: 'NOT_FOUND' });
    }
    await assertCanManageCompany(req.user!, existing.companyId);
    await discounts.deleteSportDiscount(existing.id);
    await bustVenueCache();
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
});
