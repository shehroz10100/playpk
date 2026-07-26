import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Client } from 'pg';

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw Object.assign(new Error('DATABASE_URL is not set on Vercel'), {
      status: 503,
      code: 'DATABASE_URL_REQUIRED',
    });
  }
  if (url.includes('.railway.internal')) {
    throw Object.assign(
      new Error('DATABASE_URL still uses postgres.railway.internal'),
      { status: 503, code: 'DATABASE_URL_REQUIRED' },
    );
  }
  return url;
}

export function newId(): string {
  return `c${randomBytes(12).toString('hex')}`;
}

export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: databaseUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Apply channel tables if Railway migrate has not run yet. */
export async function ensureChannelSchema(client: Client): Promise<void> {
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "ChannelKind" AS ENUM ('SPORT', 'VENUE', 'AREA', 'GENERAL');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "ChannelVisibility" AS ENUM ('PUBLIC', 'INVITE');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "ChannelMemberRole" AS ENUM ('ADMIN', 'MODERATOR', 'MEMBER');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "ChatChannel" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "kind" "ChannelKind" NOT NULL DEFAULT 'GENERAL',
      "visibility" "ChannelVisibility" NOT NULL DEFAULT 'PUBLIC',
      "sportId" TEXT REFERENCES "Sport"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      "branchId" TEXT REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      "city" TEXT,
      "createdById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "archivedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "ChannelMember" (
      "id" TEXT PRIMARY KEY,
      "channelId" TEXT NOT NULL REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "role" "ChannelMemberRole" NOT NULL DEFAULT 'MEMBER',
      "mutedUntil" TIMESTAMP(3),
      "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("channelId", "userId")
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "ChannelMessage" (
      "id" TEXT PRIMARY KEY,
      "channelId" TEXT NOT NULL REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "senderId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "body" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deletedAt" TIMESTAMP(3)
    );
  `);
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function requireUserId(req: Request): string {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) {
    throw Object.assign(new Error('Authentication required'), {
      status: 401,
      code: 'UNAUTHORIZED',
    });
  }
  const secret = process.env.JWT_ACCESS_SECRET?.trim();
  if (!secret) {
    throw Object.assign(
      new Error(
        'JWT_ACCESS_SECRET is not set on Vercel. Copy the same value from Railway API variables, then redeploy.',
      ),
      { status: 503, code: 'JWT_SECRET_REQUIRED' },
    );
  }
  const token = header.slice('Bearer '.length).trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw Object.assign(new Error('Invalid or expired access token'), {
      status: 401,
      code: 'UNAUTHORIZED',
    });
  }
  const [headerB64, payloadB64, sig] = parts;
  const expected = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const expectedB64 = b64url(expected);
  const a = Buffer.from(expectedB64);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw Object.assign(new Error('Invalid or expired access token'), {
      status: 401,
      code: 'UNAUTHORIZED',
    });
  }
  const payload = JSON.parse(
    Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
  ) as { sub?: string; type?: string; exp?: number };
  if (payload.type !== 'access' || !payload.sub) {
    throw Object.assign(new Error('Invalid or expired access token'), {
      status: 401,
      code: 'UNAUTHORIZED',
    });
  }
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw Object.assign(new Error('Invalid or expired access token'), {
      status: 401,
      code: 'UNAUTHORIZED',
    });
  }
  return payload.sub;
}

export function jsonOk<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function jsonErr(err: unknown) {
  if (typeof err === 'object' && err && 'status' in err && 'message' in err) {
    const e = err as { status: number; code?: string; message: string };
    return Response.json(
      {
        success: false,
        error: { code: e.code || 'ERROR', message: e.message },
      },
      { status: e.status || 500 },
    );
  }
  const message = err instanceof Error ? err.message : 'Something went wrong';
  return Response.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message } },
    { status: 500 },
  );
}

export function httpError(message: string, status: number, code: string) {
  return Object.assign(new Error(message), { status, code });
}
