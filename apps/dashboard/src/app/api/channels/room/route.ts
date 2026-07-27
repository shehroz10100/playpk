import { runChannels } from '@/lib/channels-dispatch';

export const runtime = 'nodejs';

function channelIdFrom(req: Request): string {
  const id = new URL(req.url).searchParams.get('channelId')?.trim() || '';
  if (!id) {
    return '';
  }
  return id;
}

async function handle(req: Request) {
  const channelId = channelIdFrom(req);
  if (!channelId) {
    return Response.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'channelId required' } },
      { status: 400 },
    );
  }
  return runChannels(req, [channelId]);
}

export const GET = handle;
export const PATCH = handle;
export const DELETE = handle;
