import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { appConfig } from './config/env';
import { healthRouter } from './routes/health';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './lib/errors';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(appConfig.isDev ? 'dev' : 'combined'));

  // Serve local uploads in development
  app.use('/uploads', express.static(path.resolve(appConfig.storage.localPath)));

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'PlayPK API',
        version: '0.1.0',
        docs: '/docs (coming soon)',
        health: '/health',
      },
    });
  });

  app.use('/health', healthRouter);
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
