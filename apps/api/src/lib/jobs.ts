type JobHandler = (payload: unknown) => Promise<void>;

const handlers = new Map<string, JobHandler>();
const queue: Array<{ type: string; payload: unknown }> = [];
let draining = false;

export function registerJob(type: string, handler: JobHandler) {
  handlers.set(type, handler);
}

/** Enqueue work to run after the current request finishes. */
export function enqueueJob(type: string, payload: unknown) {
  queue.push({ type, payload });
  void drainQueue();
}

async function drainQueue() {
  if (draining) return;
  draining = true;

  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) continue;
    const handler = handlers.get(job.type);
    if (!handler) {
      console.warn(`[Jobs] No handler for type=${job.type}`);
      continue;
    }
    try {
      await handler(job.payload);
    } catch (error) {
      console.error(`[Jobs] Failed type=${job.type}`, error);
    }
  }

  draining = false;
}
