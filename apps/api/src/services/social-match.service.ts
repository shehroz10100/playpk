import {
  CasualMatchType,
  MatchFormat,
  MatchVisibility,
  OpenMatchPlayerStatus,
  OpenMatchStatus,
  SkillLevel,
  type OpenMatch,
  type PlayerProfile,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

const SKILL_ORDER: SkillLevel[] = [
  SkillLevel.BEGINNER,
  SkillLevel.INTERMEDIATE,
  SkillLevel.ADVANCED,
  SkillLevel.PRO,
];

function skillRank(level: SkillLevel): number {
  return SKILL_ORDER.indexOf(level);
}

function maxPlayersForFormat(format: MatchFormat): number {
  return format === MatchFormat.SINGLES ? 2 : 4;
}

function hashPhone(phone: string): string {
  const normalized = phone.replace(/\D/g, '');
  return createHash('sha256').update(normalized).digest('hex');
}

async function ensureProfile(userId: string): Promise<PlayerProfile> {
  const existing = await prisma.playerProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.playerProfile.create({
    data: { userId, skillLevel: SkillLevel.BEGINNER },
  });
}

const matchInclude = {
  sport: { select: { id: true, name: true } },
  host: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, city: true } },
  players: {
    where: { status: { in: [OpenMatchPlayerStatus.JOINED, OpenMatchPlayerStatus.INVITED] } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          playerProfile: { select: { skillLevel: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  result: true,
};

function serializeMatch(
  match: OpenMatch & {
    sport: { id: string; name: string };
    host: { id: string; name: string };
    branch: { id: string; name: string; city: string } | null;
    players: Array<{
      id: string;
      userId: string;
      status: OpenMatchPlayerStatus;
      side: string | null;
      user: { id: string; name: string; playerProfile: { skillLevel: SkillLevel } | null };
    }>;
    result: {
      homeScore: number;
      awayScore: number;
      winnerSide: string | null;
      notes: string | null;
    } | null;
  },
) {
  const joined = match.players.filter((p) => p.status === OpenMatchPlayerStatus.JOINED);
  return {
    id: match.id,
    title: match.title,
    notes: match.notes,
    visibility: match.visibility,
    matchType: match.matchType,
    format: match.format,
    skillMin: match.skillMin,
    skillMax: match.skillMax,
    status: match.status,
    maxPlayers: match.maxPlayers,
    joinedCount: joined.length,
    scheduledAt: match.scheduledAt,
    city: match.city,
    sport: match.sport,
    host: match.host,
    branch: match.branch,
    players: match.players.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      skillLevel: p.user.playerProfile?.skillLevel ?? null,
      status: p.status,
      side: p.side,
    })),
    result: match.result
      ? {
          homeScore: match.result.homeScore,
          awayScore: match.result.awayScore,
          winnerSide: match.result.winnerSide,
          notes: match.result.notes,
        }
      : null,
    createdAt: match.createdAt,
  };
}

export async function getMyProfile(userId: string) {
  const profile = await ensureProfile(userId);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      playerProfile: { include: { primarySport: { select: { id: true, name: true } } } },
      _count: { select: { follows: true, followers: true } },
    },
  });
  const p = user.playerProfile ?? profile;
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    skillLevel: p.skillLevel,
    primarySportId: p.primarySportId,
    primarySportName: user.playerProfile?.primarySport?.name ?? null,
    bio: p.bio,
    wins: p.wins,
    losses: p.losses,
    points: p.points,
    matchesPlayed: p.matchesPlayed,
    onboardingComplete: p.onboardingComplete,
    followersCount: user._count.followers,
    followingCount: user._count.follows,
  };
}

export async function completeSkillOnboarding(
  userId: string,
  input: {
    skillLevel: SkillLevel;
    primarySportId?: string;
    bio?: string;
    answers?: { yearsPlaying?: number; playsWeekly?: boolean; competes?: boolean };
  },
) {
  let skill = input.skillLevel;
  if (input.answers) {
    if (input.answers.competes) skill = SkillLevel.ADVANCED;
    else if ((input.answers.yearsPlaying ?? 0) >= 3 || input.answers.playsWeekly)
      skill = SkillLevel.INTERMEDIATE;
    else skill = SkillLevel.BEGINNER;
  }
  await ensureProfile(userId);
  await prisma.playerProfile.update({
    where: { userId },
    data: {
      skillLevel: skill,
      primarySportId: input.primarySportId ?? null,
      bio: input.bio ?? null,
      onboardingComplete: true,
    },
  });
  return getMyProfile(userId);
}

export async function listOpenMatches(input: {
  userId: string;
  city?: string;
  sportId?: string;
  visibility?: MatchVisibility;
  status?: OpenMatchStatus;
}) {
  const profile = await ensureProfile(input.userId);
  const matches = await prisma.openMatch.findMany({
    where: {
      AND: [
        input.city ? { city: { equals: input.city, mode: 'insensitive' } } : {},
        input.sportId ? { sportId: input.sportId } : {},
        input.status ? { status: input.status } : { status: { in: [OpenMatchStatus.OPEN, OpenMatchStatus.FULL, OpenMatchStatus.IN_PROGRESS] } },
        {
          OR: [
            { visibility: MatchVisibility.PUBLIC },
            { hostId: input.userId },
            { players: { some: { userId: input.userId } } },
          ],
        },
        input.visibility ? { visibility: input.visibility } : {},
      ],
    },
    include: matchInclude,
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  });

  // Prefer matches near user's skill for ordering
  return matches
    .map(serializeMatch)
    .sort((a, b) => {
      const aDist = Math.min(
        Math.abs(skillRank(a.skillMin) - skillRank(profile.skillLevel)),
        Math.abs(skillRank(a.skillMax) - skillRank(profile.skillLevel)),
      );
      const bDist = Math.min(
        Math.abs(skillRank(b.skillMin) - skillRank(profile.skillLevel)),
        Math.abs(skillRank(b.skillMax) - skillRank(profile.skillLevel)),
      );
      return aDist - bDist;
    });
}

export async function getOpenMatch(matchId: string, userId: string) {
  const match = await prisma.openMatch.findUnique({
    where: { id: matchId },
    include: matchInclude,
  });
  if (!match) throw new AppError('Match not found', { statusCode: 404, code: 'NOT_FOUND' });
  if (
    match.visibility === MatchVisibility.PRIVATE &&
    match.hostId !== userId &&
    !match.players.some((p) => p.userId === userId)
  ) {
    throw new AppError('Private match — invite required', { statusCode: 403, code: 'FORBIDDEN' });
  }
  return serializeMatch(match);
}

export async function createOpenMatch(
  hostId: string,
  input: {
    title: string;
    sportId: string;
    visibility: MatchVisibility;
    matchType: CasualMatchType;
    format: MatchFormat;
    skillMin?: SkillLevel;
    skillMax?: SkillLevel;
    notes?: string;
    city?: string;
    branchId?: string;
    scheduledAt?: string;
  },
) {
  await ensureProfile(hostId);
  const sport = await prisma.sport.findUnique({ where: { id: input.sportId } });
  if (!sport) throw new AppError('Sport not found', { statusCode: 404, code: 'NOT_FOUND' });

  const maxPlayers = maxPlayersForFormat(input.format);
  const match = await prisma.openMatch.create({
    data: {
      hostId,
      sportId: input.sportId,
      branchId: input.branchId,
      title: input.title,
      notes: input.notes,
      visibility: input.visibility,
      matchType: input.matchType,
      format: input.format,
      skillMin: input.skillMin ?? SkillLevel.BEGINNER,
      skillMax: input.skillMax ?? SkillLevel.PRO,
      maxPlayers,
      city: input.city,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      players: {
        create: { userId: hostId, status: OpenMatchPlayerStatus.JOINED, side: 'HOME' },
      },
    },
    include: matchInclude,
  });
  return serializeMatch(match);
}

export async function joinOpenMatch(matchId: string, userId: string) {
  const profile = await ensureProfile(userId);
  const match = await prisma.openMatch.findUnique({
    where: { id: matchId },
    include: { players: true },
  });
  if (!match) throw new AppError('Match not found', { statusCode: 404, code: 'NOT_FOUND' });
  if (match.visibility === MatchVisibility.PRIVATE) {
    const invited = match.players.find(
      (p) => p.userId === userId && p.status === OpenMatchPlayerStatus.INVITED,
    );
    if (!invited && match.hostId !== userId) {
      throw new AppError('This is a private match. Ask the host for an invite.', {
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    }
  }
  if (![OpenMatchStatus.OPEN, OpenMatchStatus.FULL].includes(match.status)) {
    throw new AppError('Match is not open to join', { statusCode: 400, code: 'BAD_REQUEST' });
  }
  const myRank = skillRank(profile.skillLevel);
  if (myRank < skillRank(match.skillMin) || myRank > skillRank(match.skillMax)) {
    throw new AppError('Your skill level is outside this match range', {
      statusCode: 400,
      code: 'SKILL_MISMATCH',
    });
  }

  const joined = match.players.filter((p) => p.status === OpenMatchPlayerStatus.JOINED);
  const existing = match.players.find((p) => p.userId === userId);
  if (existing?.status === OpenMatchPlayerStatus.JOINED) {
    return getOpenMatch(matchId, userId);
  }
  if (joined.length >= match.maxPlayers && !existing) {
    throw new AppError('Match is full', { statusCode: 400, code: 'MATCH_FULL' });
  }

  if (existing) {
    await prisma.openMatchPlayer.update({
      where: { id: existing.id },
      data: { status: OpenMatchPlayerStatus.JOINED },
    });
  } else {
    const side = joined.length % 2 === 0 ? 'HOME' : 'AWAY';
    await prisma.openMatchPlayer.create({
      data: { matchId, userId, status: OpenMatchPlayerStatus.JOINED, side },
    });
  }

  const after = await prisma.openMatchPlayer.count({
    where: { matchId, status: OpenMatchPlayerStatus.JOINED },
  });
  if (after >= match.maxPlayers) {
    await prisma.openMatch.update({
      where: { id: matchId },
      data: { status: OpenMatchStatus.FULL },
    });
  }
  return getOpenMatch(matchId, userId);
}

export async function invitePlayerToMatch(
  matchId: string,
  hostId: string,
  input: { userId?: string; email?: string; phone?: string },
) {
  const match = await prisma.openMatch.findUnique({ where: { id: matchId } });
  if (!match) throw new AppError('Match not found', { statusCode: 404, code: 'NOT_FOUND' });
  if (match.hostId !== hostId) {
    throw new AppError('Only the host can invite', { statusCode: 403, code: 'FORBIDDEN' });
  }

  let targetId = input.userId;
  if (!targetId && (input.email || input.phone)) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          input.email ? { email: input.email.toLowerCase() } : undefined,
          input.phone ? { phone: input.phone } : undefined,
        ].filter(Boolean) as Array<{ email?: string; phone?: string }>,
      },
    });
    if (!user) throw new AppError('Player not found', { statusCode: 404, code: 'NOT_FOUND' });
    targetId = user.id;
  }
  if (!targetId) throw new AppError('Provide userId, email, or phone', { statusCode: 400, code: 'BAD_REQUEST' });
  if (targetId === hostId) throw new AppError('Cannot invite yourself', { statusCode: 400, code: 'BAD_REQUEST' });

  await prisma.openMatchPlayer.upsert({
    where: { matchId_userId: { matchId, userId: targetId } },
    create: { matchId, userId: targetId, status: OpenMatchPlayerStatus.INVITED },
    update: { status: OpenMatchPlayerStatus.INVITED },
  });

  await prisma.notification.create({
    data: {
      userId: targetId,
      title: 'Match invite',
      body: `You're invited to "${match.title}". Open Play to join.`,
      meta: { type: 'OPEN_MATCH_INVITE', matchId },
    },
  });

  return getOpenMatch(matchId, hostId);
}

export async function reportMatchResult(
  matchId: string,
  reporterId: string,
  input: { homeScore: number; awayScore: number; notes?: string },
) {
  const match = await prisma.openMatch.findUnique({
    where: { id: matchId },
    include: { players: true, result: true },
  });
  if (!match) throw new AppError('Match not found', { statusCode: 404, code: 'NOT_FOUND' });
  if (match.result) throw new AppError('Result already recorded', { statusCode: 400, code: 'ALREADY_REPORTED' });

  const isPlayer = match.players.some(
    (p) => p.userId === reporterId && p.status === OpenMatchPlayerStatus.JOINED,
  );
  if (!isPlayer && match.hostId !== reporterId) {
    throw new AppError('Only match players can report scores', { statusCode: 403, code: 'FORBIDDEN' });
  }

  const winnerSide =
    input.homeScore === input.awayScore ? 'DRAW' : input.homeScore > input.awayScore ? 'HOME' : 'AWAY';

  await prisma.$transaction(async (tx) => {
    await tx.openMatchResult.create({
      data: {
        matchId,
        reportedById: reporterId,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        winnerSide,
        notes: input.notes,
      },
    });
    await tx.openMatch.update({
      where: { id: matchId },
      data: { status: OpenMatchStatus.COMPLETED },
    });

    const joined = match.players.filter((p) => p.status === OpenMatchPlayerStatus.JOINED);
    const competitive = match.matchType === CasualMatchType.COMPETITIVE;
    const winPts = competitive ? 25 : 15;
    const lossPts = competitive ? 5 : 8;

    for (const p of joined) {
      await ensureProfile(p.userId);
      const won =
        winnerSide === 'DRAW'
          ? null
          : (p.side ?? 'HOME') === winnerSide;
      await tx.playerProfile.update({
        where: { userId: p.userId },
        data: {
          matchesPlayed: { increment: 1 },
          wins: won === true ? { increment: 1 } : undefined,
          losses: won === false ? { increment: 1 } : undefined,
          points: { increment: won === true ? winPts : won === false ? lossPts : 10 },
        },
      });
    }

    await tx.socialPost.create({
      data: {
        authorId: reporterId,
        matchId,
        body: `Match result · ${match.title}: ${input.homeScore}–${input.awayScore}${
          winnerSide === 'DRAW' ? ' (draw)' : ` · ${winnerSide} wins`
        }`,
      },
    });
  });

  return getOpenMatch(matchId, reporterId);
}

export async function searchPlayers(userId: string, q: string) {
  const query = q.trim();
  if (query.length < 2) return [];
  const users = await prisma.user.findMany({
    where: {
      role: 'PLAYER',
      id: { not: userId },
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
      ],
    },
    take: 20,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      playerProfile: { select: { skillLevel: true, points: true } },
      followers: { where: { followerId: userId }, select: { id: true } },
    },
  });
  return users.map((u) => ({
    userId: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    skillLevel: u.playerProfile?.skillLevel ?? null,
    points: u.playerProfile?.points ?? 0,
    isFollowing: u.followers.length > 0,
  }));
}

export async function followPlayer(followerId: string, followingId: string) {
  if (followerId === followingId) {
    throw new AppError('Cannot follow yourself', { statusCode: 400, code: 'BAD_REQUEST' });
  }
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId, followingId } },
    create: { followerId, followingId },
    update: {},
  });
  return { following: true };
}

export async function unfollowPlayer(followerId: string, followingId: string) {
  await prisma.follow.deleteMany({ where: { followerId, followingId } });
  return { following: false };
}

export async function listFeed(userId: string, starredOnly = false) {
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const authorIds = [userId, ...following.map((f) => f.followingId)];

  const posts = await prisma.socialPost.findMany({
    where: {
      authorId: { in: authorIds },
      ...(starredOnly
        ? { stars: { some: { userId } } }
        : {}),
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          playerProfile: { select: { skillLevel: true } },
        },
      },
      stars: { select: { userId: true } },
      _count: { select: { stars: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return posts.map((p) => ({
    id: p.id,
    body: p.body,
    matchId: p.matchId,
    createdAt: p.createdAt,
    author: {
      id: p.author.id,
      name: p.author.name,
      skillLevel: p.author.playerProfile?.skillLevel ?? null,
    },
    starCount: p._count.stars,
    starredByMe: p.stars.some((s) => s.userId === userId),
  }));
}

export async function createPost(userId: string, body: string, matchId?: string) {
  const post = await prisma.socialPost.create({
    data: { authorId: userId, body: body.trim(), matchId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          playerProfile: { select: { skillLevel: true } },
        },
      },
      _count: { select: { stars: true } },
    },
  });
  return {
    id: post.id,
    body: post.body,
    matchId: post.matchId,
    createdAt: post.createdAt,
    author: {
      id: post.author.id,
      name: post.author.name,
      skillLevel: post.author.playerProfile?.skillLevel ?? null,
    },
    starCount: 0,
    starredByMe: false,
  };
}

export async function toggleStar(userId: string, postId: string) {
  const existing = await prisma.socialStar.findUnique({
    where: { postId_userId: { postId, userId } },
  });
  if (existing) {
    await prisma.socialStar.delete({ where: { id: existing.id } });
    return { starred: false };
  }
  await prisma.socialStar.create({ data: { postId, userId } });
  return { starred: true };
}

export async function syncContacts(userId: string, phones: string[]) {
  const hashes = [...new Set(phones.map(hashPhone).filter(Boolean))];
  if (hashes.length === 0) return [];

  await prisma.$transaction(
    hashes.map((phoneHash) =>
      prisma.contactHash.upsert({
        where: { userId_phoneHash: { userId, phoneHash } },
        create: { userId, phoneHash },
        update: {},
      }),
    ),
  );

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      role: 'PLAYER',
      phone: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      playerProfile: { select: { skillLevel: true, points: true } },
      followers: { where: { followerId: userId }, select: { id: true } },
    },
    take: 200,
  });

  return users
    .filter((u) => u.phone && hashes.includes(hashPhone(u.phone)))
    .map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      skillLevel: u.playerProfile?.skillLevel ?? null,
      points: u.playerProfile?.points ?? 0,
      isFollowing: u.followers.length > 0,
      fromContacts: true,
    }));
}

export async function performanceLeaderboard(limit = 50) {
  const rows = await prisma.playerProfile.findMany({
    where: { matchesPlayed: { gt: 0 } },
    orderBy: [{ points: 'desc' }, { wins: 'desc' }],
    take: limit,
    include: {
      user: { select: { id: true, name: true } },
      primarySport: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    userId: r.userId,
    name: r.user.name,
    skillLevel: r.skillLevel,
    wins: r.wins,
    losses: r.losses,
    points: r.points,
    matchesPlayed: r.matchesPlayed,
    primarySportName: r.primarySport?.name ?? null,
  }));
}
