import { runChannels } from '@/lib/channels-dispatch';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const channelId = new URL(req.url).searchParams.get('channelId')?.trim() || '';
  if (!channelId) {
    return Response.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'channelId required' } },
      { status: 400 },
    );
  }
  return runChannels(req, [channelId, 'leave']);
}
