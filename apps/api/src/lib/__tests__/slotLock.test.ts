import Redis from 'ioredis';
import { RedisMemoryServer } from 'redis-memory-server';

/**
 * Integration-style lock tests against a real Redis (memory server).
 * Validates SET NX semantics used for slot double-booking prevention.
 */
describe('Redis slot lock', () => {
  let server: RedisMemoryServer;
  let redis: Redis;
  let acquireSlotLock: (slotId: string) => Promise<string | null>;
  let releaseSlotLock: (slotId: string, token: string) => Promise<void>;

  beforeAll(async () => {
    server = await RedisMemoryServer.create();
    const host = await server.getHost();
    const port = await server.getPort();
    process.env.REDIS_URL = `redis://${host}:${port}`;
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? 'postgresql://playpk:playpk@localhost:5432/playpk?schema=public';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars!!';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars!';
    process.env.SLOT_LOCK_TTL_SECONDS = '30';

    // Re-import modules after env is set
    jest.resetModules();
    const redisMod = await import('../../lib/redis');
    redis = redisMod.redis;
    await redisMod.connectRedis();
    const lockMod = await import('../../lib/slotLock');
    acquireSlotLock = lockMod.acquireSlotLock;
    releaseSlotLock = lockMod.releaseSlotLock;
  }, 120000);

  afterAll(async () => {
    await redis.quit();
    await server.stop();
  });

  it('allows only one holder of a slot lock at a time', async () => {
    const first = await acquireSlotLock('slot-race-1');
    const second = await acquireSlotLock('slot-race-1');
    expect(first).toBeTruthy();
    expect(second).toBeNull();
    await releaseSlotLock('slot-race-1', first!);
    const third = await acquireSlotLock('slot-race-1');
    expect(third).toBeTruthy();
    await releaseSlotLock('slot-race-1', third!);
  });

  it('does not release a lock owned by a different token', async () => {
    const token = await acquireSlotLock('slot-race-2');
    expect(token).toBeTruthy();
    await releaseSlotLock('slot-race-2', 'wrong-token');
    const stillLocked = await acquireSlotLock('slot-race-2');
    expect(stillLocked).toBeNull();
    await releaseSlotLock('slot-race-2', token!);
  });
});
