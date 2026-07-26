import { runChannels } from '@/lib/channels-dispatch';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ channelId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { channelId } = await ctx.params;
  return runChannels(req, [channelId]);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { channelId } = await ctx.params;
  return runChannels(req, [channelId]);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { channelId } = await ctx.params;
  return runChannels(req, [channelId]);
}
