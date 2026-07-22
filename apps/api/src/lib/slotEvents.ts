import { EventEmitter } from 'node:events';
import { redis } from './redis';

export type SlotStatusEvent = {
  type: 'slot.status.changed';
  slotId: string;
  branchId: string;
  courtId: string;
  status: string;
  bookingSource?: string | null;
  at: string;
};

const CHANNEL = 'playpk:slot-status';
const localBus = new EventEmitter();
localBus.setMaxListeners(100);

let subscribed = false;

async function ensureSubscriber(): Promise<void> {
  if (subscribed) return;
  subscribed = true;
  try {
    const sub = redis.duplicate();
    await sub.subscribe(CHANNEL);
    sub.on('message', (_ch, message) => {
      try {
        const event = JSON.parse(message) as SlotStatusEvent;
        localBus.emit('slot', event);
        if (event.branchId) localBus.emit(`branch:${event.branchId}`, event);
      } catch {
        /* ignore bad payloads */
      }
    });
  } catch {
    // Redis pub/sub optional — local bus still works in-process
  }
}

export async function publishSlotStatusChanged(event: Omit<SlotStatusEvent, 'type' | 'at'>): Promise<void> {
  const payload: SlotStatusEvent = {
    type: 'slot.status.changed',
    at: new Date().toISOString(),
    ...event,
  };
  localBus.emit('slot', payload);
  if (event.branchId) localBus.emit(`branch:${event.branchId}`, payload);
  try {
    await redis.publish(CHANNEL, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function subscribeBranchSlots(
  branchId: string,
  handler: (event: SlotStatusEvent) => void,
): () => void {
  void ensureSubscriber();
  const key = `branch:${branchId}`;
  localBus.on(key, handler);
  return () => localBus.off(key, handler);
}
