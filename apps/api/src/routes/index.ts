import { Router } from 'express';

/**
 * Versioned API routes.
 * Health lives at GET /health (mounted separately in app.ts).
 * Domain routes land here as Phase 1+ progresses.
 */
export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      message: 'PlayPK API v1',
      endpoints: {
        health: 'GET /health',
      },
    },
  });
});
