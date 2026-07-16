import { Router } from 'express';
import { FEATURED_SPORT_ORDER, orderSportsForRail, resolveSportCover } from '@playpk/shared-types';
import { prisma } from '../lib/prisma';
import { sendSuccess } from '../lib/errors';
import { cacheGet, cacheSet } from '../lib/cache';

export const sportsRouter = Router();

const SPORTS_CACHE_KEY = 'sports:list';
const SPORTS_TTL_SECONDS = 3600;

sportsRouter.get('/', async (_req, res, next) => {
  try {
    const cached = await cacheGet<{
      data: unknown[];
      meta: { featured: string[] };
    }>(SPORTS_CACHE_KEY);

    if (cached) {
      sendSuccess(res, cached.data, 200, cached.meta);
      return;
    }

    const sports = await prisma.sport.findMany();
    const ordered = orderSportsForRail(sports).map((s) => ({
      ...s,
      iconUrl: resolveSportCover(s.name, s.iconUrl),
    }));
    const meta = { featured: [...FEATURED_SPORT_ORDER] };
    await cacheSet(SPORTS_CACHE_KEY, { data: ordered, meta }, SPORTS_TTL_SECONDS);
    sendSuccess(res, ordered, 200, meta);
  } catch (error) {
    next(error);
  }
});
