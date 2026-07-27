import { runChannels } from '@/lib/channels-dispatch';

export const runtime = 'nodejs';

/**
 * Static room API — dynamic /api/channels/[id] does not match on this Vercel setup.
 * Use ?channelId=&op=
 */
export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
export async function PATCH(req: Request) {
  return handle(req);
}
export async function DELETE(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const channelId = url.searchParams.get('channelId')?.trim() || '';
  const op = (url.searchParams.get('op') || '').trim();
  const method = req.method.toUpperCase();

  if (!channelId) {
    return Response.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'channelId required' } },
      { status: 400 },
    );
  }

  let action = op;
  if (!action) {
    if (method === 'GET') action = 'get';
    else if (method === 'PATCH') action = 'patch';
    else if (method === 'DELETE') action = 'archive';
    else if (method === 'POST') action = 'join';
  }

  const userId = url.searchParams.get('userId')?.trim() || '';
  const messageId = url.searchParams.get('messageId')?.trim() || '';

  switch (action) {
    case 'get':
    case 'patch':
    case 'archive':
      return runChannels(req, [channelId]);
    case 'join':
      return runChannels(req, [channelId, 'join']);
    case 'leave':
      return runChannels(req, [channelId, 'leave']);
    case 'members':
      return runChannels(req, [channelId, 'members']);
    case 'membersSearch':
      return runChannels(req, [channelId, 'members', 'search']);
    case 'member':
      if (!userId) {
        return Response.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'userId required' } },
          { status: 400 },
        );
      }
      return runChannels(req, [channelId, 'members', userId]);
    case 'messages':
    case 'send':
      return runChannels(req, [channelId, 'messages']);
    case 'deleteMessage':
      if (!messageId) {
        return Response.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'messageId required' },
          },
          { status: 400 },
        );
      }
      return runChannels(req, [channelId, 'messages', messageId]);
    default:
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Unknown op: ${action}` } },
        { status: 400 },
      );
  }
}
