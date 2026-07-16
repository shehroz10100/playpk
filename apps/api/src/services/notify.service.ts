import { TournamentStatus, UserRole, type Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';

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

/** Notify all players when a company publishes an OPEN tournament. */
export async function notifyPlayersOfTournamentListed(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      sport: true,
      branch: { select: { id: true, name: true, city: true } },
    },
  });
  if (!tournament || tournament.status !== TournamentStatus.OPEN) return;

  const players = await prisma.user.findMany({
    where: { role: UserRole.PLAYER, suspendedAt: null },
    select: { id: true },
  });
  if (players.length === 0) return;

  const start = tournament.startDate.toISOString().slice(0, 10);
  const fee = Number(tournament.entryFee);
  const title = 'New tournament';
  const body = `${tournament.name} · ${tournament.sport.name} at ${tournament.branch.name} (${tournament.branch.city}) · starts ${start} · entry Rs ${fee}`;
  const meta = {
    type: 'TOURNAMENT_LISTED',
    tournamentId: tournament.id,
    branchId: tournament.branchId,
    sportId: tournament.sportId,
  } satisfies Record<string, unknown>;

  await prisma.notification.createMany({
    data: players.map((p) => ({
      userId: p.id,
      title,
      body,
      meta: meta as Prisma.InputJsonValue,
    })),
  });

  console.log(
    `[MockNotify] TOURNAMENT_LISTED tournament=${tournament.id} players=${players.length} title="${title}"`,
  );
}
