import { runChannels } from '@/lib/channels-dispatch';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ channelId: string; messageId: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  const { channelId, messageId } = await ctx.params;
  return runChannels(req, [channelId, 'messages', messageId]);
}
