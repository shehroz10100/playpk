import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { playpkPrisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      'DATABASE_URL is not set on Vercel. Copy it from Railway api → Variables into the playpk Vercel project (Production), then redeploy.',
    );
  }
  if (!globalForPrisma.playpkPrisma) {
    globalForPrisma.playpkPrisma = new PrismaClient();
  }
  return globalForPrisma.playpkPrisma;
}
