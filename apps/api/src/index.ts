import { createApp } from './app';
import { appConfig } from './config/env';
import { connectRedis } from './lib/redis';
import { prisma } from './lib/prisma';
import { registerBackgroundJobs } from './services/jobs.registry';

async function bootstrap(): Promise<void> {
  registerBackgroundJobs();
  // Ensure Redis is reachable early so slot-locking is ready later
  try {
    await connectRedis();
    console.log('✓ Redis connected');
  } catch (error) {
    console.warn('⚠ Redis not available yet — health will report degraded:', error);
  }

  // Touch Prisma so connection errors surface at boot
  try {
    await prisma.$connect();
    console.log('✓ Postgres connected');
  } catch (error) {
    console.error('✗ Postgres connection failed:', error);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(appConfig.port, () => {
    console.log(`🚀 PlayPK API listening on http://localhost:${appConfig.port}`);
    console.log(`   Health: http://localhost:${appConfig.port}/health`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start API:', error);
  process.exit(1);
});
