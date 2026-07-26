import { runChannels } from '@/lib/channels-dispatch';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ channelId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { channelId } = await ctx.params;
  return runChannels(req, [channelId, 'join']);
}
