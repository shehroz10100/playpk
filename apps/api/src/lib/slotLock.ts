import { randomUUID } from 'node:crypto';
import { appConfig } from '../config/env';
import { redis } from './redis';

/**
 * Acquire a short-lived Redis lock for a slot during the booking transaction.
 * Uses SET NX EX so only one concurrent booking attempt can proceed.
 */
export async function acquireSlotLock(slotId: string): Promise<string | null> {
  const token = randomUUID();
  const key = `slot-lock:${slotId}`;
  const result = await redis.set(key, token, 'EX', appConfig.slotLockTtlSeconds, 'NX');
  return result === 'OK' ? token : null;
}

/** Release only if we still own the lock (compare-and-del via Lua). */
export async function releaseSlotLock(slotId: string, token: string): Promise<void> {
  const key = `slot-lock:${slotId}`;
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, key, token);
}
