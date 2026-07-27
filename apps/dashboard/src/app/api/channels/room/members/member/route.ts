import { runChannels } from '@/lib/channels-dispatch';

export const runtime = 'nodejs';

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const channelId = url.searchParams.get('channelId')?.trim() || '';
  const userId = url.searchParams.get('userId')?.trim() || '';
  if (!channelId || !userId) {
    return Response.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'channelId and userId required' },
      },
      { status: 400 },
    );
  }
  return runChannels(req, [channelId, 'members', userId]);
}

export async function PATCH(req: Request) {
  const url = new URL(req.url);
  const channelId = url.searchParams.get('channelId')?.trim() || '';
  const userId = url.searchParams.get('userId')?.trim() || '';
  if (!channelId || !userId) {
    return Response.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'channelId and userId required' },
      },
      { status: 400 },
    );
  }
  return runChannels(req, [channelId, 'members', userId]);
}
