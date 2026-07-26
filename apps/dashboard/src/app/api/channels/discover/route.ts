import { runChannels } from '@/lib/channels-dispatch';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  return runChannels(req, ['discover']);
}
