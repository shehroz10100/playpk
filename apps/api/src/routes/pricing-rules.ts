import { Router } from 'express';
import { z } from 'zod';
import { PricingChannel, PricingDayType, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError, sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import { assertCanManageCompany, assertCanManageBranch } from '../services/access.service';
import { resolvePrice } from '../pricing/resolvePrice';

export const pricingRulesRouter = Router();

pricingRulesRouter.use(authenticate);
pricingRulesRouter.use(
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
);

const ruleBodyBase = z.object({
  companyId: z.string().min(1),
  branchId: z.string().nullable().optional(),
  courtId: z.string().nullable().optional(),
  sportId: z.string().nullable().optional(),
  dayType: z.nativeEnum(PricingDayType),
  timeRangeStart: z.string().regex(/^\d{2}:\d{2}$/),
  timeRangeEnd: z.string().regex(/^\d{2}:\d{2}$/),
  channel: z.nativeEnum(PricingChannel).default(PricingChannel.BOTH),
  priceOverride: z.number().positive().nullable().optional(),
  priceMultiplier: z.number().positive().nullable().optional(),
  priority: z.number().int().default(0),
  validFrom: z.string().datetime().nullable().optional(),
  validTo: z.string().datetime().nullable().optional(),
  active: z.boolean().default(true),
});

const ruleBody = ruleBodyBase.refine(
  (v) => v.priceOverride != null || v.priceMultiplier != null,
  { message: 'Provide priceOverride or priceMultiplier' },
);

pricingRulesRouter.get('/', async (req, res, next) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : '';
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
    if (!companyId) {
      throw new AppError('companyId is required', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    await assertCanManageCompany(req.user!, companyId);
    const rules = await prisma.pricingRule.findMany({
      where: {
        companyId,
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    sendSuccess(
      res,
      rules.map((r) => ({
        ...r,
        priceOverride: r.priceOverride != null ? Number(r.priceOverride) : null,
        priceMultiplier: r.priceMultiplier != null ? Number(r.priceMultiplier) : null,
      })),
    );
  } catch (error) {
    next(error);
  }
});

pricingRulesRouter.post('/', validate(ruleBody), async (req, res, next) => {
  try {
    await assertCanManageCompany(req.user!, req.body.companyId);
    if (req.body.branchId) await assertCanManageBranch(req.user!, req.body.branchId);
    const rule = await prisma.pricingRule.create({
      data: {
        companyId: req.body.companyId,
        branchId: req.body.branchId ?? null,
        courtId: req.body.courtId ?? null,
        sportId: req.body.sportId ?? null,
        dayType: req.body.dayType,
        timeRangeStart: req.body.timeRangeStart,
        timeRangeEnd: req.body.timeRangeEnd,
        channel: req.body.channel,
        priceOverride: req.body.priceOverride ?? null,
        priceMultiplier: req.body.priceMultiplier ?? null,
        priority: req.body.priority ?? 0,
        validFrom: req.body.validFrom ? new Date(req.body.validFrom) : null,
        validTo: req.body.validTo ? new Date(req.body.validTo) : null,
        active: req.body.active ?? true,
      },
    });
    sendSuccess(res, rule, 201);
  } catch (error) {
    next(error);
  }
});

pricingRulesRouter.get('/preview', async (req, res, next) => {
  try {
    const courtId = typeof req.query.courtId === 'string' ? req.query.courtId : '';
    const date = typeof req.query.date === 'string' ? req.query.date : '';
    const startTime = typeof req.query.startTime === 'string' ? req.query.startTime : '';
    const channel =
      req.query.channel === 'WALK_IN' || req.query.channel === 'ONLINE'
        ? req.query.channel
        : 'BOTH';
    if (!courtId || !date || !startTime) {
      throw new AppError('courtId, date, startTime required', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    const court = await prisma.court.findUnique({
      where: { id: courtId },
      include: { branch: true },
    });
    if (!court) {
      throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
    }
    await assertCanManageBranch(req.user!, court.branchId);
    const resolved = await resolvePrice(
      courtId,
      new Date(`${date}T00:00:00.000Z`),
      startTime,
      channel === 'WALK_IN' ? 'WALK_IN' : 'ONLINE',
    );
    sendSuccess(res, {
      ...resolved,
      preview: `${court.name}, ${date} ${startTime} -> Rs. ${resolved.price} (base Rs. ${resolved.basePrice}${
        resolved.appliedRuleLabel ? ` + ${resolved.appliedRuleLabel}` : ''
      })`,
    });
  } catch (error) {
    next(error);
  }
});

pricingRulesRouter.patch(
  '/:ruleId',
  validate(ruleBodyBase.partial().omit({ companyId: true })),
  async (req, res, next) => {
    try {
      const existing = await prisma.pricingRule.findUnique({
        where: { id: param(req, 'ruleId') },
      });
      if (!existing) {
        throw new AppError('Rule not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      await assertCanManageCompany(req.user!, existing.companyId);
      const rule = await prisma.pricingRule.update({
        where: { id: existing.id },
        data: {
          ...(req.body.branchId !== undefined ? { branchId: req.body.branchId } : {}),
          ...(req.body.courtId !== undefined ? { courtId: req.body.courtId } : {}),
          ...(req.body.sportId !== undefined ? { sportId: req.body.sportId } : {}),
          ...(req.body.dayType !== undefined ? { dayType: req.body.dayType } : {}),
          ...(req.body.timeRangeStart !== undefined
            ? { timeRangeStart: req.body.timeRangeStart }
            : {}),
          ...(req.body.timeRangeEnd !== undefined ? { timeRangeEnd: req.body.timeRangeEnd } : {}),
          ...(req.body.channel !== undefined ? { channel: req.body.channel } : {}),
          ...(req.body.priceOverride !== undefined
            ? { priceOverride: req.body.priceOverride }
            : {}),
          ...(req.body.priceMultiplier !== undefined
            ? { priceMultiplier: req.body.priceMultiplier }
            : {}),
          ...(req.body.priority !== undefined ? { priority: req.body.priority } : {}),
          ...(req.body.active !== undefined ? { active: req.body.active } : {}),
        },
      });
      sendSuccess(res, rule);
    } catch (error) {
      next(error);
    }
  },
);

pricingRulesRouter.delete('/:ruleId', async (req, res, next) => {
  try {
    const existing = await prisma.pricingRule.findUnique({
      where: { id: param(req, 'ruleId') },
    });
    if (!existing) {
      throw new AppError('Rule not found', { statusCode: 404, code: 'NOT_FOUND' });
    }
    await assertCanManageCompany(req.user!, existing.companyId);
    await prisma.pricingRule.delete({ where: { id: existing.id } });
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
});
