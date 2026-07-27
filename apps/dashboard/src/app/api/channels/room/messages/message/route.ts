import { runChannels } from '@/lib/channels-dispatch';

export const runtime = 'nodejs';

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const channelId = url.searchParams.get('channelId')?.trim() || '';
  const messageId = url.searchParams.get('messageId')?.trim() || '';
  if (!channelId || !messageId) {
    return Response.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'channelId and messageId required' },
      },
      { status: 400 },
    );
  }
  return runChannels(req, [channelId, 'messages', messageId]);
}
