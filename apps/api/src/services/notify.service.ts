import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/** In-app notification + console mock "push/SMS". */
export async function notifyUser(
  db: Db,
  input: {
    userId: string;
    title: string;
    body: string;
    meta?: Record<string, unknown>;
  },
) {
  const notification = await db.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      meta: (input.meta as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });

  console.log(
    `[MockNotify] user=${input.userId} title="${input.title}" body="${input.body}"`,
  );

  return notification;
}
