import { Client } from 'pg';
import bcrypt from 'bcryptjs';

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set on Vercel. Use the public Railway Postgres URL (not *.railway.internal), then redeploy.',
    );
  }
  if (url.includes('.railway.internal')) {
    throw new Error(
      'DATABASE_URL still uses postgres.railway.internal. Replace it with the public DATABASE_PUBLIC_URL from Railway Postgres.',
    );
  }
  return url;
}

export async function updateUserPasswordByEmail(
  email: string,
  password: string,
): Promise<void> {
  const client = new Client({
    connectionString: databaseUrl(),
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const found = await client.query<{ id: string; suspendedAt: Date | null }>(
      `SELECT id, "suspendedAt" FROM "User" WHERE email = $1 LIMIT 1`,
      [email],
    );
    const user = found.rows[0];
    if (!user || user.suspendedAt) {
      const err = new Error('Invalid or expired verification code') as Error & {
        status: number;
        code: string;
      };
      err.status = 400;
      err.code = 'INVALID_OTP';
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await client.query(`UPDATE "User" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE id = $2`, [
      passwordHash,
      user.id,
    ]);
    await client.query(
      `UPDATE "RefreshToken" SET "revokedAt" = NOW() WHERE "userId" = $1 AND "revokedAt" IS NULL`,
      [user.id],
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}
