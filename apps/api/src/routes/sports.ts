import { Router } from 'express';
import { FEATURED_SPORT_ORDER, orderSportsForRail, resolveSportCover } from '@playpk/shared-types';
import { prisma } from '../lib/prisma';
import { sendSuccess } from '../lib/errors';

export const sportsRouter = Router();

sportsRouter.get('/', async (_req, res, next) => {
  try {
    const sports = await prisma.sport.findMany();
    const ordered = orderSportsForRail(sports).map((s) => ({
      ...s,
      iconUrl: resolveSportCover(s.name, s.iconUrl),
    }));
    sendSuccess(res, ordered, 200, {
      featured: [...FEATURED_SPORT_ORDER],
    });
  } catch (error) {
    next(error);
  }
});
