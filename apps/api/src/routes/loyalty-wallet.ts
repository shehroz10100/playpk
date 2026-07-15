import { z } from 'zod';
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess } from '../lib/errors';
import { nextTierProgress } from '../services/loyalty.service';
import { topUpWallet } from '../services/wallet.service';

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
    }),
  ),
  async (req, res, next) => {
    try {
      const result = await topUpWallet(prisma, {
        userId: req.user!.id,
        amount: req.body.amount,
        reason: req.body.reason,
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
