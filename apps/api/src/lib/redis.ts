import Redis from 'ioredis';
import { appConfig } from '../config/env';

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

export const redis =
  globalForRedis.redis ??
  new Redis(appConfig.redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

if (appConfig.env !== 'production') {
  globalForRedis.redis = redis;
}

export async function connectRedis(): Promise<void> {
  if (redis.status === 'ready' || redis.status === 'connecting') {
    return;
  }
  await redis.connect();
}

export async function pingRedis(): Promise<boolean> {
  try {
    if (redis.status !== 'ready') {
      await connectRedis();
    }
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}
