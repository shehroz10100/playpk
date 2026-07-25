import { z } from 'zod';
import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError, sendSuccess } from '../lib/errors';
import { nextTierProgress } from '../services/loyalty.service';
import { topUpWallet } from '../services/wallet.service';
import { mockPaymentsAllowed } from '../lib/security-flags';

export const loyaltyRouter = Router();
export const walletRouter = Router();
export const notificationsRouter = Router();

loyaltyRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const progress = nextTierProgress(user.loyaltyPoints);
    const recent = await prisma.loyaltyTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    sendSuccess(res, {
      loyaltyPoints: user.loyaltyPoints,
      loyaltyTier: user.loyaltyTier,
      ...progress,
      recent,
    });
  } catch (error) {
    next(error);
  }
});

walletRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const recent = await prisma.walletTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    sendSuccess(res, {
      walletBalance: Number(user.walletBalance),
      recent: recent.map((t) => ({
        ...t,
        amount: Number(t.amount),
      })),
    });
  } catch (error) {
    next(error);
  }
});

walletRouter.post(
  '/topup',
  authenticate,
  validate(
    z.object({
      amount: z.number().positive().max(100000),
      reason: z.string().optional(),
      /** Target user — admin only; players can only top up themselves in mock mode. */
      userId: z.string().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const isAdmin = req.user!.role === UserRole.ADMIN;
      const targetUserId = req.body.userId ?? req.user!.id;

      if (req.body.userId && req.body.userId !== req.user!.id && !isAdmin) {
        throw new AppError('Only admins can credit another wallet', {
          statusCode: 403,
          code: 'FORBIDDEN',
        });
      }

      // Players: only when mock payments enabled (local/demo). Admins: always.
      if (!isAdmin && !mockPaymentsAllowed()) {
        throw new AppError(
          'Self-serve wallet top-up is disabled. Pay at booking or contact support.',
          { statusCode: 403, code: 'MOCK_PAYMENTS_DISABLED' },
        );
      }

      const result = await topUpWallet(prisma, {
        userId: targetUserId,
        amount: req.body.amount,
        reason: req.body.reason,
        asAdmin: isAdmin,
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },
);

/** Explicit admin-only credit path (works in production). */
walletRouter.post(
  '/admin-credit',
  authenticate,
  requireRoles(UserRole.ADMIN),
  validate(
    z.object({
      userId: z.string().min(1),
      amount: z.number().positive().max(100000),
      reason: z.string().min(3).max(200).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const result = await topUpWallet(prisma, {
        userId: req.body.userId,
        amount: req.body.amount,
        reason: req.body.reason,
        asAdmin: true,
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },
);

notificationsRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const items = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    sendSuccess(res, items);
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post('/me/read-all', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    sendSuccess(res, { ok: true });
  } catch (error) {
    next(error);
  }
});
