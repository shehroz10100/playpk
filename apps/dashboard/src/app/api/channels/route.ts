import { runChannels } from '@/lib/channels-dispatch';

export const runtime = 'nodejs';

/** POST /api/channels — create channel */
export async function POST(req: Request) {
  return runChannels(req, []);
}
