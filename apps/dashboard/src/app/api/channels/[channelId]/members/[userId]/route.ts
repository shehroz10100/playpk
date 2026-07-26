import { runChannels } from '@/lib/channels-dispatch';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ channelId: string; userId: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  const { channelId, userId } = await ctx.params;
  return runChannels(req, [channelId, 'members', userId]);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { channelId, userId } = await ctx.params;
  return runChannels(req, [channelId, 'members', userId]);
}
