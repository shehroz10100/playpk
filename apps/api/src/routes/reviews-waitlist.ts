import { z } from 'zod';
import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import { assertCanManageBranch } from '../services/access.service';
import { listBranchReviews, upsertBranchReview } from '../services/review.service';
import { joinWaitlist, listWaitlistForBranch } from '../services/waitlist.service';

export const reviewsRouter = Router();
export const waitlistRouter = Router();

reviewsRouter.get('/branches/:branchId', async (req, res, next) => {
  try {
    const data = await listBranchReviews(param(req, 'branchId'));
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

reviewsRouter.post(
  '/branches/:branchId',
  authenticate,
  validate(
    z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(1000).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const data = await upsertBranchReview({
        userId: req.user!.id,
        branchId: param(req, 'branchId'),
        rating: req.body.rating,
        comment: req.body.comment,
      });
      sendSuccess(res, data, 201);
    } catch (error) {
      next(error);
    }
  },
);

waitlistRouter.post(
  '/slots/:slotId',
  authenticate,
  async (req, res, next) => {
    try {
      const data = await joinWaitlist({
        userId: req.user!.id,
        slotId: param(req, 'slotId'),
      });
      sendSuccess(res, data, 201);
    } catch (error) {
      next(error);
    }
  },
);

waitlistRouter.get(
  '/branches/:branchId',
  authenticate,
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  async (req, res, next) => {
    try {
      await assertCanManageBranch(req.user!, param(req, 'branchId'));
      const entries = await listWaitlistForBranch(param(req, 'branchId'));
      sendSuccess(
        res,
        entries.map((e) => ({
          id: e.id,
          createdAt: e.createdAt,
          user: e.user,
          slot: {
            id: e.slot.id,
            date: e.slot.date,
            startTime: e.slot.startTime,
            endTime: e.slot.endTime,
            court: e.slot.court,
          },
        })),
      );
    } catch (error) {
      next(error);
    }
  },
);
