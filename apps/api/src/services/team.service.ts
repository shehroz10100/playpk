import { TeamInviteStatus, TeamMemberRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { notifyUser } from './notify.service';

export async function createTeam(input: {
  captainId: string;
  name: string;
  sportId?: string;
}) {
  const team = await prisma.team.create({
    data: {
      name: input.name,
      sportId: input.sportId,
      captainId: input.captainId,
      members: {
        create: {
          userId: input.captainId,
          role: TeamMemberRole.CAPTAIN,
        },
      },
    },
    include: {
      sport: true,
      captain: { select: { id: true, name: true, email: true, phone: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      },
    },
  });
  return serializeTeam(team);
}

function serializeTeam(team: {
  id: string;
  name: string;
  sportId: string | null;
  captainId: string;
  createdAt: Date;
  sport?: { id: string; name: string } | null;
  captain?: { id: string; name: string; email: string | null; phone: string | null };
  members?: Array<{
    id: string;
    role: TeamMemberRole;
    user: { id: string; name: string; email: string | null; phone: string | null };
  }>;
  invites?: Array<{
    id: string;
    email: string | null;
    phone: string | null;
    status: TeamInviteStatus;
    invitedUserId: string | null;
    createdAt: Date;
  }>;
}) {
  return {
    id: team.id,
    name: team.name,
    sportId: team.sportId,
    captainId: team.captainId,
    createdAt: team.createdAt,
    sport: team.sport ?? null,
    captain: team.captain,
    members: (team.members ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      user: m.user,
    })),
    invites: team.invites ?? [],
  };
}

export async function listMyTeams(userId: string) {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: {
        include: {
          sport: true,
          captain: { select: { id: true, name: true, email: true, phone: true } },
          members: {
            include: { user: { select: { id: true, name: true, email: true, phone: true } } },
          },
          invites: {
            where: { status: TeamInviteStatus.PENDING },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });
  return memberships.map((m) => serializeTeam(m.team));
}

export async function getTeam(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      sport: true,
      captain: { select: { id: true, name: true, email: true, phone: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      },
      invites: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!team) {
    throw new AppError('Team not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  return serializeTeam(team);
}

export async function inviteToTeam(input: {
  teamId: string;
  invitedById: string;
  email?: string;
  phone?: string;
}) {
  if (!input.email && !input.phone) {
    throw new AppError('Provide email or phone to invite', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: input.teamId, userId: input.invitedById } },
  });
  if (!member) {
    throw new AppError('Only team members can invite', { statusCode: 403, code: 'FORBIDDEN' });
  }

  const invitedUser = await prisma.user.findFirst({
    where: {
      OR: [
        ...(input.email ? [{ email: { equals: input.email, mode: 'insensitive' as const } }] : []),
        ...(input.phone ? [{ phone: input.phone }] : []),
      ],
    },
  });

  const invite = await prisma.teamInvite.create({
    data: {
      teamId: input.teamId,
      invitedById: input.invitedById,
      email: input.email,
      phone: input.phone,
      invitedUserId: invitedUser?.id,
      status: TeamInviteStatus.PENDING,
    },
  });

  if (invitedUser) {
    const team = await prisma.team.findUniqueOrThrow({ where: { id: input.teamId } });
    await notifyUser(prisma, {
      userId: invitedUser.id,
      title: 'Team invite',
      body: `You've been invited to join ${team.name}. Open Teams to accept.`,
      meta: { type: 'TEAM_INVITE', inviteId: invite.id, teamId: input.teamId },
    });
  }

  console.log(
    `[TeamInvite] team=${input.teamId} email=${input.email ?? '-'} phone=${input.phone ?? '-'} user=${invitedUser?.id ?? 'unknown'}`,
  );

  return invite;
}

export async function listMyInvites(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return prisma.teamInvite.findMany({
    where: {
      status: TeamInviteStatus.PENDING,
      OR: [
        { invitedUserId: userId },
        ...(user.email ? [{ email: { equals: user.email, mode: 'insensitive' as const } }] : []),
        ...(user.phone ? [{ phone: user.phone }] : []),
      ],
    },
    include: {
      team: {
        include: {
          sport: true,
          captain: { select: { id: true, name: true } },
        },
      },
      invitedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function respondToInvite(input: {
  inviteId: string;
  userId: string;
  accept: boolean;
}) {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: input.inviteId },
    include: { team: true },
  });
  if (!invite || invite.status !== TeamInviteStatus.PENDING) {
    throw new AppError('Invite not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  const allowed =
    invite.invitedUserId === input.userId ||
    (invite.email && user.email && invite.email.toLowerCase() === user.email.toLowerCase()) ||
    (invite.phone && user.phone && invite.phone === user.phone);
  if (!allowed) {
    throw new AppError('Forbidden', { statusCode: 403, code: 'FORBIDDEN' });
  }

  if (!input.accept) {
    return prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: TeamInviteStatus.DECLINED, invitedUserId: input.userId },
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.teamInvite.update({
      where: { id: invite.id },
      data: { status: TeamInviteStatus.ACCEPTED, invitedUserId: input.userId },
    });
    await tx.teamMember.upsert({
      where: { teamId_userId: { teamId: invite.teamId, userId: input.userId } },
      create: {
        teamId: invite.teamId,
        userId: input.userId,
        role: TeamMemberRole.MEMBER,
      },
      update: {},
    });
  });

  return getTeam(invite.teamId);
}
