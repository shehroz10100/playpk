import {
  MatchStatus,
  PaymentStatus,
  TournamentFormat,
  TournamentStatus,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { getPaymentProvider } from './payments/MockPaymentProvider';

function parseDate(value: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new AppError('Invalid date', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  return d;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

const regInclude = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  team: { select: { id: true, name: true } },
} satisfies Prisma.TournamentRegistrationInclude;

export function serializeTournament(
  t: {
    id: string;
    branchId: string;
    name: string;
    sportId: string;
    format: TournamentFormat;
    status: TournamentStatus;
    entryFee: Prisma.Decimal | number;
    prizePool: Prisma.Decimal | number;
    maxParticipants: number | null;
    description: string | null;
    startDate: Date;
    endDate: Date;
    createdAt: Date;
    sport?: { id: string; name: string };
    branch?: { id: string; name: string; city: string };
    _count?: { registrations?: number; matches?: number };
    registrations?: unknown[];
  },
) {
  return {
    id: t.id,
    branchId: t.branchId,
    name: t.name,
    sportId: t.sportId,
    format: t.format,
    status: t.status,
    entryFee: Number(t.entryFee),
    prizePool: Number(t.prizePool),
    maxParticipants: t.maxParticipants,
    description: t.description,
    startDate: t.startDate,
    endDate: t.endDate,
    createdAt: t.createdAt,
    sport: t.sport,
    branch: t.branch,
    registrationCount: t._count?.registrations ?? t.registrations?.length ?? 0,
    matchCount: t._count?.matches ?? 0,
  };
}

export async function createTournament(input: {
  branchId: string;
  name: string;
  sportId: string;
  format: TournamentFormat;
  entryFee: number;
  prizePool?: number;
  startDate: string;
  endDate: string;
  maxParticipants?: number;
  description?: string;
  status?: TournamentStatus;
}) {
  const startDate = parseDate(input.startDate);
  const endDate = parseDate(input.endDate);
  if (endDate < startDate) {
    throw new AppError('endDate must be on/after startDate', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const sport = await prisma.sport.findUnique({ where: { id: input.sportId } });
  if (!sport) {
    throw new AppError('Sport not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const tournament = await prisma.tournament.create({
    data: {
      branchId: input.branchId,
      name: input.name,
      sportId: input.sportId,
      format: input.format,
      status: input.status ?? TournamentStatus.OPEN,
      entryFee: input.entryFee,
      prizePool: input.prizePool ?? 0,
      startDate,
      endDate,
      maxParticipants: input.maxParticipants,
      description: input.description,
    },
    include: {
      sport: true,
      branch: { select: { id: true, name: true, city: true } },
      _count: { select: { registrations: true, matches: true } },
    },
  });

  if (tournament.status === TournamentStatus.OPEN) {
    const { enqueueJob } = await import('../lib/jobs');
    enqueueJob('NOTIFY_TOURNAMENT_LISTED', { tournamentId: tournament.id });
  }

  return serializeTournament(tournament);
}

export async function updateTournament(
  tournamentId: string,
  input: Partial<{
    name: string;
    entryFee: number;
    prizePool: number;
    startDate: string;
    endDate: string;
    maxParticipants: number | null;
    description: string | null;
    status: TournamentStatus;
  }>,
) {
  const existing = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!existing) {
    throw new AppError('Tournament not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.entryFee !== undefined ? { entryFee: input.entryFee } : {}),
      ...(input.prizePool !== undefined ? { prizePool: input.prizePool } : {}),
      ...(input.startDate !== undefined ? { startDate: parseDate(input.startDate) } : {}),
      ...(input.endDate !== undefined ? { endDate: parseDate(input.endDate) } : {}),
      ...(input.maxParticipants !== undefined ? { maxParticipants: input.maxParticipants } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: {
      sport: true,
      branch: { select: { id: true, name: true, city: true } },
      _count: { select: { registrations: true, matches: true } },
    },
  });

  const publishedNow =
    input.status === TournamentStatus.OPEN && existing.status !== TournamentStatus.OPEN;
  if (publishedNow) {
    const { enqueueJob } = await import('../lib/jobs');
    enqueueJob('NOTIFY_TOURNAMENT_LISTED', { tournamentId: updated.id });
  }

  return serializeTournament(updated);
}

export async function listTournaments(filter: {
  branchId?: string;
  sportId?: string;
  status?: TournamentStatus;
  city?: string;
  minFee?: number;
  maxFee?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  if (
    filter.minFee !== undefined &&
    filter.maxFee !== undefined &&
    filter.maxFee < filter.minFee
  ) {
    throw new AppError('maxFee must be >= minFee', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const dateFrom = filter.dateFrom ? parseDate(filter.dateFrom) : undefined;
  const dateTo = filter.dateTo ? parseDate(filter.dateTo) : undefined;
  if (dateFrom && dateTo && dateTo < dateFrom) {
    throw new AppError('dateTo must be on/after dateFrom', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const items = await prisma.tournament.findMany({
    where: {
      ...(filter.branchId ? { branchId: filter.branchId } : {}),
      ...(filter.sportId ? { sportId: filter.sportId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.city
        ? { branch: { city: { equals: filter.city, mode: 'insensitive' } } }
        : {}),
      ...(filter.minFee !== undefined || filter.maxFee !== undefined
        ? {
            entryFee: {
              ...(filter.minFee !== undefined ? { gte: filter.minFee } : {}),
              ...(filter.maxFee !== undefined ? { lte: filter.maxFee } : {}),
            },
          }
        : {}),
      ...(dateFrom ? { endDate: { gte: dateFrom } } : {}),
      ...(dateTo ? { startDate: { lte: dateTo } } : {}),
    },
    include: {
      sport: true,
      branch: { select: { id: true, name: true, city: true } },
      _count: { select: { registrations: true, matches: true } },
    },
    orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
  });
  return items.map(serializeTournament);
}

export async function getTournament(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      sport: true,
      branch: { select: { id: true, name: true, city: true, address: true } },
      registrations: {
        include: regInclude,
        orderBy: { createdAt: 'asc' },
      },
      matches: {
        include: {
          home: { include: regInclude },
          away: { include: regInclude },
          winner: { include: regInclude },
        },
        orderBy: [{ round: 'asc' }, { matchIndex: 'asc' }],
      },
      _count: { select: { registrations: true, matches: true } },
    },
  });
  if (!tournament) {
    throw new AppError('Tournament not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  return {
    ...serializeTournament(tournament),
    registrations: tournament.registrations.map((r) => ({
      id: r.id,
      userId: r.userId,
      teamId: r.teamId,
      seed: r.seed,
      paymentStatus: r.paymentStatus,
      paidAmount: Number(r.paidAmount),
      createdAt: r.createdAt,
      user: r.user,
      team: r.team,
    })),
    matches: tournament.matches.map(serializeMatch),
  };
}

function serializeMatch(m: {
  id: string;
  tournamentId: string;
  round: number;
  matchIndex: number;
  homeRegistrationId: string | null;
  awayRegistrationId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerRegistrationId: string | null;
  status: MatchStatus;
  scheduledAt: Date | null;
  home?: {
    id: string;
    user: { id: string; name: string };
    team: { id: string; name: string } | null;
  } | null;
  away?: {
    id: string;
    user: { id: string; name: string };
    team: { id: string; name: string } | null;
  } | null;
  winner?: {
    id: string;
    user: { id: string; name: string };
    team: { id: string; name: string } | null;
  } | null;
}) {
  return {
    id: m.id,
    tournamentId: m.tournamentId,
    round: m.round,
    matchIndex: m.matchIndex,
    homeRegistrationId: m.homeRegistrationId,
    awayRegistrationId: m.awayRegistrationId,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    winnerRegistrationId: m.winnerRegistrationId,
    status: m.status,
    scheduledAt: m.scheduledAt,
    home: m.home
      ? {
          id: m.home.id,
          label: m.home.team?.name ?? m.home.user.name,
          user: m.home.user,
          team: m.home.team,
        }
      : null,
    away: m.away
      ? {
          id: m.away.id,
          label: m.away.team?.name ?? m.away.user.name,
          user: m.away.user,
          team: m.away.team,
        }
      : null,
    winner: m.winner
      ? {
          id: m.winner.id,
          label: m.winner.team?.name ?? m.winner.user.name,
          user: m.winner.user,
          team: m.winner.team,
        }
      : null,
  };
}

export async function registerForTournament(input: {
  tournamentId: string;
  userId: string;
  teamId?: string;
  /** Create a new team during registration (ignored if teamId is set). */
  teamName?: string;
  /** Email or phone contacts to invite onto the new/existing team. */
  teammateContacts?: string[];
  /** Optional display name for the registering player. */
  playerName?: string;
  paymentMethod?: 'mock' | 'wallet' | 'jazzcash' | 'easypaisa' | 'card';
}) {
  const method = input.paymentMethod ?? 'mock';
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    include: { _count: { select: { registrations: true } } },
  });
  if (!tournament) {
    throw new AppError('Tournament not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (tournament.status !== TournamentStatus.OPEN) {
    throw new AppError('Tournament is not open for registration', {
      statusCode: 409,
      code: 'TOURNAMENT_CLOSED',
    });
  }
  if (
    tournament.maxParticipants != null &&
    tournament._count.registrations >= tournament.maxParticipants
  ) {
    throw new AppError('Tournament is full', { statusCode: 409, code: 'TOURNAMENT_FULL' });
  }

  const existing = await prisma.tournamentRegistration.findUnique({
    where: {
      tournamentId_userId: { tournamentId: input.tournamentId, userId: input.userId },
    },
  });
  if (existing) {
    throw new AppError('Already registered', { statusCode: 409, code: 'ALREADY_REGISTERED' });
  }

  if (input.playerName?.trim()) {
    await prisma.user.update({
      where: { id: input.userId },
      data: { name: input.playerName.trim() },
    });
  }

  let teamId = input.teamId;
  if (!teamId && input.teamName?.trim()) {
    const { createTeam, inviteToTeam } = await import('./team.service');
    const team = await createTeam({
      captainId: input.userId,
      name: input.teamName.trim(),
      sportId: tournament.sportId,
    });
    teamId = team.id;
    for (const raw of input.teammateContacts ?? []) {
      const contact = raw.trim();
      if (!contact) continue;
      try {
        await inviteToTeam({
          teamId,
          invitedById: input.userId,
          ...(contact.includes('@') ? { email: contact } : { phone: contact }),
        });
      } catch {
        /* skip invalid / duplicate invites */
      }
    }
  } else if (teamId) {
    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: input.userId } },
    });
    if (!member) {
      throw new AppError('You must be a member of that team', {
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    }
    if (input.teammateContacts?.length) {
      const { inviteToTeam } = await import('./team.service');
      for (const raw of input.teammateContacts) {
        const contact = raw.trim();
        if (!contact) continue;
        try {
          await inviteToTeam({
            teamId,
            invitedById: input.userId,
            ...(contact.includes('@') ? { email: contact } : { phone: contact }),
          });
        } catch {
          /* skip */
        }
      }
    }
  }

  const fee = Number(tournament.entryFee);

  const registration = await prisma.tournamentRegistration.create({
    data: {
      tournamentId: input.tournamentId,
      userId: input.userId,
      teamId,
      paidAmount: fee,
      paymentStatus: fee === 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
      paymentIntentId: fee === 0 ? `free_${input.tournamentId}` : null,
    },
  });

  let paymentIntentId = registration.paymentIntentId;
  if (fee > 0) {
    if (method === 'wallet') {
      const { debitWallet } = await import('./wallet.service');
      await debitWallet(prisma, {
        userId: input.userId,
        amount: fee,
        bookingId: registration.id,
        reason: `Tournament entry: ${tournament.name}`,
      });
      paymentIntentId = `wallet_tournament_${registration.id}`;
    } else {
      const payment = getPaymentProvider();
      const intent = await payment.createPaymentIntent({
        amount: fee,
        currency: 'PKR',
        bookingId: registration.id,
        userId: input.userId,
        method,
        metadata: { type: 'tournament_entry', tournamentId: input.tournamentId },
      });
      paymentIntentId = intent.id;
    }
  }

  const paid = await prisma.tournamentRegistration.update({
    where: { id: registration.id },
    data: {
      paymentStatus: PaymentStatus.PAID,
      paymentIntentId,
    },
    include: regInclude,
  });

  return {
    id: paid.id,
    tournamentId: paid.tournamentId,
    userId: paid.userId,
    teamId: paid.teamId,
    paymentStatus: paid.paymentStatus,
    paidAmount: Number(paid.paidAmount),
    paymentIntentId: paid.paymentIntentId,
    user: paid.user,
    team: paid.team,
  };
}

/**
 * Generate a single-elimination bracket from paid registrations.
 * Pads to next power of 2 with byes (auto-advancing null opponents).
 */
export async function generateKnockoutFixtures(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { paymentStatus: PaymentStatus.PAID },
        orderBy: { createdAt: 'asc' },
      },
      matches: true,
    },
  });
  if (!tournament) {
    throw new AppError('Tournament not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (tournament.format !== TournamentFormat.KNOCKOUT) {
    throw new AppError('Fixture generation currently supports KNOCKOUT only', {
      statusCode: 400,
      code: 'UNSUPPORTED_FORMAT',
    });
  }
  if (tournament.registrations.length < 2) {
    throw new AppError('Need at least 2 paid registrations', {
      statusCode: 400,
      code: 'NOT_ENOUGH_PLAYERS',
    });
  }
  if (tournament.matches.some((m) => m.status === MatchStatus.COMPLETED)) {
    throw new AppError('Cannot regenerate after results have been entered', {
      statusCode: 409,
      code: 'RESULTS_EXIST',
    });
  }

  await prisma.tournamentMatch.deleteMany({ where: { tournamentId } });

  const players = tournament.registrations.map((r) => r.id);
  const bracketSize = nextPowerOf2(players.length);
  const rounds = Math.log2(bracketSize);
  const byes = bracketSize - players.length;
  const seeded: Array<string | null> = [...players];
  for (let i = 0; i < byes; i += 1) seeded.push(null);

  // Round 1 pairings
  const round1Count = bracketSize / 2;
  const created: Prisma.TournamentMatchCreateManyInput[] = [];

  for (let i = 0; i < round1Count; i += 1) {
    const home = seeded[i * 2] ?? null;
    const away = seeded[i * 2 + 1] ?? null;
    const isBye = (home == null) !== (away == null); // exactly one null = bye
    const bothBye = home == null && away == null;
    created.push({
      tournamentId,
      round: 1,
      matchIndex: i,
      homeRegistrationId: home,
      awayRegistrationId: away,
      winnerRegistrationId: isBye ? (home ?? away) : null,
      status: bothBye
        ? MatchStatus.CANCELLED
        : isBye
          ? MatchStatus.COMPLETED
          : MatchStatus.SCHEDULED,
      homeScore: isBye ? 1 : null,
      awayScore: isBye ? 0 : null,
    });
  }

  // Later rounds (empty slots; filled as results come in / bye advances)
  for (let round = 2; round <= rounds; round += 1) {
    const count = bracketSize / 2 ** round;
    for (let i = 0; i < count; i += 1) {
      created.push({
        tournamentId,
        round,
        matchIndex: i,
        status: MatchStatus.SCHEDULED,
      });
    }
  }

  await prisma.tournamentMatch.createMany({ data: created });

  // Advance bye winners into next round slots
  const round1 = await prisma.tournamentMatch.findMany({
    where: { tournamentId, round: 1, status: MatchStatus.COMPLETED },
  });
  for (const match of round1) {
    if (match.winnerRegistrationId) {
      await placeWinnerInNextRound(tournamentId, match.round, match.matchIndex, match.winnerRegistrationId);
    }
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: TournamentStatus.IN_PROGRESS },
  });

  return getTournament(tournamentId);
}

async function placeWinnerInNextRound(
  tournamentId: string,
  round: number,
  matchIndex: number,
  winnerRegistrationId: string,
) {
  const nextRound = round + 1;
  const nextIndex = Math.floor(matchIndex / 2);
  const next = await prisma.tournamentMatch.findUnique({
    where: {
      tournamentId_round_matchIndex: { tournamentId, round: nextRound, matchIndex: nextIndex },
    },
  });
  if (!next) return;

  const isHome = matchIndex % 2 === 0;
  await prisma.tournamentMatch.update({
    where: { id: next.id },
    data: isHome
      ? { homeRegistrationId: winnerRegistrationId }
      : { awayRegistrationId: winnerRegistrationId },
  });
}

export async function recordMatchResult(input: {
  matchId: string;
  homeScore: number;
  awayScore: number;
}) {
  if (input.homeScore === input.awayScore) {
    throw new AppError('Knockout matches cannot draw — enter a winner', {
      statusCode: 400,
      code: 'NO_DRAWS',
    });
  }

  const match = await prisma.tournamentMatch.findUnique({
    where: { id: input.matchId },
  });
  if (!match) {
    throw new AppError('Match not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (!match.homeRegistrationId || !match.awayRegistrationId) {
    throw new AppError('Both players must be set before recording a result', {
      statusCode: 409,
      code: 'INCOMPLETE_MATCH',
    });
  }

  const winnerId =
    input.homeScore > input.awayScore ? match.homeRegistrationId : match.awayRegistrationId;

  const updated = await prisma.tournamentMatch.update({
    where: { id: match.id },
    data: {
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      winnerRegistrationId: winnerId,
      status: MatchStatus.COMPLETED,
    },
    include: {
      home: { include: regInclude },
      away: { include: regInclude },
      winner: { include: regInclude },
    },
  });

  await placeWinnerInNextRound(
    match.tournamentId,
    match.round,
    match.matchIndex,
    winnerId,
  );

  // Mark tournament completed if final is done
  const finals = await prisma.tournamentMatch.findFirst({
    where: { tournamentId: match.tournamentId },
    orderBy: { round: 'desc' },
  });
  if (finals && finals.round === match.round && updated.status === MatchStatus.COMPLETED) {
    await prisma.tournament.update({
      where: { id: match.tournamentId },
      data: { status: TournamentStatus.COMPLETED },
    });
  }

  return serializeMatch(updated);
}

export async function getStandings(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: { include: regInclude },
      matches: { where: { status: MatchStatus.COMPLETED } },
    },
  });
  if (!tournament) {
    throw new AppError('Tournament not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const stats = new Map<
    string,
    { registrationId: string; wins: number; losses: number; played: number }
  >();
  for (const r of tournament.registrations) {
    stats.set(r.id, { registrationId: r.id, wins: 0, losses: 0, played: 0 });
  }
  for (const m of tournament.matches) {
    if (!m.winnerRegistrationId) continue;
    const loserId =
      m.winnerRegistrationId === m.homeRegistrationId
        ? m.awayRegistrationId
        : m.homeRegistrationId;
    const w = stats.get(m.winnerRegistrationId);
    if (w) {
      w.wins += 1;
      w.played += 1;
    }
    if (loserId) {
      const l = stats.get(loserId);
      if (l) {
        l.losses += 1;
        l.played += 1;
      }
    }
  }

  return [...stats.values()]
    .map((s) => {
      const reg = tournament.registrations.find((r) => r.id === s.registrationId)!;
      return {
        registrationId: s.registrationId,
        label: reg.team?.name ?? reg.user.name,
        user: reg.user,
        team: reg.team,
        wins: s.wins,
        losses: s.losses,
        played: s.played,
        points: s.wins * 3,
      };
    })
    .sort((a, b) => b.points - a.points || b.wins - a.wins);
}

/** Public leaderboard derived from completed tournament matches at a branch (+ optional sport). */
export async function getBranchLeaderboard(input: { branchId: string; sportId?: string }) {
  const matches = await prisma.tournamentMatch.findMany({
    where: {
      status: MatchStatus.COMPLETED,
      winnerRegistrationId: { not: null },
      tournament: {
        branchId: input.branchId,
        ...(input.sportId ? { sportId: input.sportId } : {}),
      },
    },
    include: {
      winner: {
        include: {
          user: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
        },
      },
      tournament: { include: { sport: true } },
    },
  });

  const board = new Map<
    string,
    {
      userId: string;
      name: string;
      wins: number;
      points: number;
      sports: Set<string>;
    }
  >();

  for (const m of matches) {
    if (!m.winner) continue;
    const userId = m.winner.userId;
    const row = board.get(userId) ?? {
      userId,
      name: m.winner.user.name,
      wins: 0,
      points: 0,
      sports: new Set<string>(),
    };
    row.wins += 1;
    row.points += 3;
    row.sports.add(m.tournament.sport.name);
    board.set(userId, row);
  }

  return [...board.values()]
    .map((r) => ({
      userId: r.userId,
      name: r.name,
      wins: r.wins,
      points: r.points,
      sports: [...r.sports],
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .slice(0, 50);
}
