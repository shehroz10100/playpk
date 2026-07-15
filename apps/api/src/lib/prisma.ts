import { PrismaClient } from '@prisma/client';
import { appConfig } from '../config/env';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: appConfig.isDev ? ['error', 'warn'] : ['error'],
  });

if (appConfig.env !== 'production') {
  globalForPrisma.prisma = prisma;
}
