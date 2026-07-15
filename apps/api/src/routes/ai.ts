import { z } from 'zod';
import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError, sendSuccess } from '../lib/errors';
import { assertCanManageBranch, assertCanManageCompany } from '../services/access.service';
import { suggestCourtPricing } from '../services/ai/pricing.service';
import { getAnalytics } from '../services/ai/analytics.service';
import { answerAvailabilityQuestion } from '../services/ai/chatbot.service';

export const aiRouter = Router();

aiRouter.post(
  '/pricing/suggest',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  validate(
    z.object({
      courtId: z.string().min(1),
      fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      holidayDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const court = await prisma.court.findUnique({ where: { id: req.body.courtId } });
      if (!court) {
        throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      await assertCanManageBranch(req.user!, court.branchId);
      const data = await suggestCourtPricing(req.body);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },
);

aiRouter.get(
  '/analytics',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
      const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;

      if (branchId) {
        await assertCanManageBranch(req.user!, branchId);
      } else if (companyId) {
        await assertCanManageCompany(req.user!, companyId);
      }

      const data = await getAnalytics({ branchId, companyId });
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },
);

aiRouter.post(
  '/chat',
  validate(
    z.object({
      message: z.string().min(2).max(500),
    }),
  ),
  async (req, res, next) => {
    try {
      // Optional auth — players may chat without login for discovery
      const data = await answerAvailabilityQuestion(req.body.message);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },
);
