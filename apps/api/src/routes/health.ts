import { Router } from 'express';
import type { HealthStatus } from '@playpk/shared-types';
import { prisma } from '../lib/prisma';
import { pingRedis } from '../lib/redis';
import { sendSuccess } from '../lib/errors';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res, next) => {
  try {
    let database: HealthStatus['checks']['database'] = 'down';
    let redis: HealthStatus['checks']['redis'] = 'down';

    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    redis = (await pingRedis()) ? 'up' : 'down';

    const allUp = database === 'up' && redis === 'up';
    const noneUp = database === 'down' && redis === 'down';

    const payload: HealthStatus = {
      status: allUp ? 'ok' : noneUp ? 'error' : 'degraded',
      service: 'playpk-api',
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };

    const httpStatus = noneUp ? 503 : 200;
    sendSuccess(res, payload, httpStatus);
  } catch (error) {
    next(error);
  }
});
