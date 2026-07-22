import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess } from '../lib/errors';
import { resolvePrice } from '../pricing/resolvePrice';

export const pricingRouter = Router();

pricingRouter.get(
  '/resolve',
  authenticate,
  validate(
    z.object({
      courtId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      channel: z.enum(['ONLINE', 'WALK_IN']).default('ONLINE'),
    }),
    'query',
  ),
  async (req, res, next) => {
    try {
      const q = (req as typeof req & {
        validatedQuery: {
          courtId: string;
          date: string;
          startTime: string;
          channel: 'ONLINE' | 'WALK_IN';
        };
      }).validatedQuery;
      const result = await resolvePrice(
        q.courtId,
        new Date(`${q.date}T00:00:00.000Z`),
        q.startTime,
        q.channel,
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },
);
