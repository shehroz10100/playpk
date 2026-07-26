import {
  ChannelKind,
  ChannelMemberRole,
  ChannelVisibility,
  CompanyApprovalStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

const MAX_MESSAGE_LEN = 2000;
const MAX_NAME_LEN = 64;

type CreateChannelInput = {
  name: string;
  description?: string;
  kind: ChannelKind;
  visibility?: ChannelVisibility;
  sportId?: string;
  branchId?: string;
  city?: string;
};

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

async function requireMembership(userId: string, channelId: string) {
  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
  if (!member) {
    throw new AppError('You are not a member of this channel', {
      statusCode: 403,
      code: 'NOT_A_MEMBER',
    });
  }
  return member;
}

async function requireStaff(userId: string, channelId: string) {
  const member = await requireMembership(userId, channelId);
  if (member.role !== ChannelMemberRole.ADMIN && member.role !== ChannelMemberRole.MODERATOR) {
    throw new AppError('Admin or moderator permission required', {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }
  return member;
}

async function requireAdmin(userId: string, channelId: string) {
  const member = await requireMembership(userId, channelId);
  if (member.role !== ChannelMemberRole.ADMIN) {
    throw new AppError('Channel admin permission required', {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }
  return member;
}

function mapChannel(
  channel: {
    id: string;
    name: string;
    description: string | null;
    kind: ChannelKind;
    visibility: ChannelVisibility;
    sportId: string | null;
    branchId: string | null;
    city: string | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    sport?: { id: string; name: string } | null;
    branch?: { id: string; name: string; city: string } | null;
    createdBy?: { id: string; name: string } | null;
    _count?: { members: number; messages: number };
    members?: { role: ChannelMemberRole }[];
  },
  opts?: { membershipRole?: ChannelMemberRole | null; lastMessage?: { body: string; createdAt: Date; senderName: string } | null },
) {
  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    kind: channel.kind,
    visibility: channel.visibility,
    sportId: channel.sportId,
    branchId: channel.branchId,
    city: channel.city,
    sportName: channel.sport?.name ?? null,
    venueName: channel.branch?.name ?? null,
    venueCity: channel.branch?.city ?? null,
    createdById: channel.createdById,
    createdByName: channel.createdBy?.name ?? null,
    memberCount: channel._count?.members ?? 0,
    messageCount: channel._count?.messages ?? 0,
    myRole: opts?.membershipRole ?? channel.members?.[0]?.role ?? null,
    lastMessage: opts?.lastMessage
      ? {
          body: opts.lastMessage.body,
          createdAt: opts.lastMessage.createdAt,
          senderName: opts.lastMessage.senderName,
        }
      : null,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  };
}

export async function createChannel(userId: string, input: CreateChannelInput) {
  const name = normalizeName(input.name);
  if (name.length < 2 || name.length > MAX_NAME_LEN) {
    throw new AppError(`Name must be 2–${MAX_NAME_LEN} characters`, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (input.sportId) {
    const sport = await prisma.sport.findUnique({ where: { id: input.sportId } });
    if (!sport) throw new AppError('Sport not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (input.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: input.branchId, approvalStatus: CompanyApprovalStatus.APPROVED },
    });
    if (!branch) throw new AppError('Venue not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const kind = input.kind;
  if (kind === ChannelKind.SPORT && !input.sportId) {
    throw new AppError('Sport channels require a sport', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  if (kind === ChannelKind.VENUE && !input.branchId) {
    throw new AppError('Venue channels require a venue', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  if (kind === ChannelKind.AREA && !String(input.city ?? '').trim()) {
    throw new AppError('Area channels require a city', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  const channel = await prisma.$transaction(async (tx) => {
    const created = await tx.chatChannel.create({
      data: {
        name,
        description: input.description?.trim() || null,
        kind,
        visibility: input.visibility ?? ChannelVisibility.PUBLIC,
        sportId: input.sportId || null,
        branchId: input.branchId || null,
        city: input.city?.trim() || null,
        createdById: userId,
        members: {
          create: {
            userId,
            role: ChannelMemberRole.ADMIN,
          },
        },
      },
      include: {
        sport: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, city: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { members: true, messages: true } },
        members: { where: { userId }, select: { role: true } },
      },
    });
    return created;
  });

  return mapChannel(channel, { membershipRole: ChannelMemberRole.ADMIN });
}

export async function listMyChannels(userId: string) {
  const memberships = await prisma.channelMember.findMany({
    where: { userId, channel: { archivedAt: null } },
    include: {
      channel: {
        include: {
          sport: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, city: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { members: true, messages: true } },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { channel: { updatedAt: 'desc' } },
  });

  return memberships.map((m) =>
    mapChannel(m.channel, {
      membershipRole: m.role,
      lastMessage: m.channel.messages[0]
        ? {
            body: m.channel.messages[0].body,
            createdAt: m.channel.messages[0].createdAt,
            senderName: m.channel.messages[0].sender.name,
          }
        : null,
    }),
  );
}

export async function discoverChannels(
  userId: string,
  filters?: { kind?: ChannelKind; city?: string; sportId?: string; q?: string },
) {
  const channels = await prisma.chatChannel.findMany({
    where: {
      archivedAt: null,
      visibility: ChannelVisibility.PUBLIC,
      ...(filters?.kind ? { kind: filters.kind } : {}),
      ...(filters?.sportId ? { sportId: filters.sportId } : {}),
      ...(filters?.city
        ? { OR: [{ city: { contains: filters.city, mode: 'insensitive' } }, { branch: { city: { contains: filters.city, mode: 'insensitive' } } }] }
        : {}),
      ...(filters?.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: 'insensitive' } },
              { description: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      members: { none: { userId } },
    },
    include: {
      sport: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true, city: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { members: true, messages: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 50,
  });

  return channels.map((c) => mapChannel(c, { membershipRole: null }));
}

export async function getChannel(userId: string, channelId: string) {
  const channel = await prisma.chatChannel.findFirst({
    where: { id: channelId, archivedAt: null },
    include: {
      sport: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true, city: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { members: true, messages: true } },
      members: { where: { userId }, select: { role: true } },
    },
  });
  if (!channel) throw new AppError('Channel not found', { statusCode: 404, code: 'NOT_FOUND' });

  const myRole = channel.members[0]?.role ?? null;
  if (channel.visibility === ChannelVisibility.INVITE && !myRole) {
    throw new AppError('This channel is invite-only', { statusCode: 403, code: 'INVITE_ONLY' });
  }

  return mapChannel(channel, { membershipRole: myRole });
}

export async function joinChannel(userId: string, channelId: string) {
  const channel = await prisma.chatChannel.findFirst({
    where: { id: channelId, archivedAt: null },
  });
  if (!channel) throw new AppError('Channel not found', { statusCode: 404, code: 'NOT_FOUND' });
  if (channel.visibility !== ChannelVisibility.PUBLIC) {
    throw new AppError('This channel is invite-only. Ask an admin to add you.', {
      statusCode: 403,
      code: 'INVITE_ONLY',
    });
  }

  const existing = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
  if (existing) return getChannel(userId, channelId);

  await prisma.channelMember.create({
    data: { channelId, userId, role: ChannelMemberRole.MEMBER },
  });
  return getChannel(userId, channelId);
}

export async function leaveChannel(userId: string, channelId: string) {
  const member = await requireMembership(userId, channelId);
  if (member.role === ChannelMemberRole.ADMIN) {
    const adminCount = await prisma.channelMember.count({
      where: { channelId, role: ChannelMemberRole.ADMIN },
    });
    if (adminCount <= 1) {
      const other = await prisma.channelMember.findFirst({
        where: { channelId, userId: { not: userId } },
        orderBy: { joinedAt: 'asc' },
      });
      if (other) {
        await prisma.channelMember.update({
          where: { id: other.id },
          data: { role: ChannelMemberRole.ADMIN },
        });
      } else {
        await prisma.chatChannel.update({
          where: { id: channelId },
          data: { archivedAt: new Date() },
        });
      }
    }
  }
  await prisma.channelMember.delete({ where: { id: member.id } });
  return { left: true };
}

export async function addMember(adminId: string, channelId: string, targetUserId: string) {
  await requireStaff(adminId, channelId);
  if (adminId === targetUserId) {
    throw new AppError('You are already in this channel', { statusCode: 400, code: 'BAD_REQUEST' });
  }
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user || user.suspendedAt) {
    throw new AppError('User not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  await prisma.channelMember.upsert({
    where: { channelId_userId: { channelId, userId: targetUserId } },
    create: { channelId, userId: targetUserId, role: ChannelMemberRole.MEMBER },
    update: {},
  });
  return listMembers(adminId, channelId);
}

export async function removeMember(actorId: string, channelId: string, targetUserId: string) {
  const actor = await requireStaff(actorId, channelId);
  if (actorId === targetUserId) {
    return leaveChannel(actorId, channelId);
  }
  const target = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: targetUserId } },
  });
  if (!target) throw new AppError('Member not found', { statusCode: 404, code: 'NOT_FOUND' });
  if (target.role === ChannelMemberRole.ADMIN && actor.role !== ChannelMemberRole.ADMIN) {
    throw new AppError('Moderators cannot remove admins', { statusCode: 403, code: 'FORBIDDEN' });
  }
  if (target.role === ChannelMemberRole.ADMIN) {
    const adminCount = await prisma.channelMember.count({
      where: { channelId, role: ChannelMemberRole.ADMIN },
    });
    if (adminCount <= 1) {
      throw new AppError('Cannot remove the last admin', { statusCode: 400, code: 'LAST_ADMIN' });
    }
  }
  await prisma.channelMember.delete({ where: { id: target.id } });
  return listMembers(actorId, channelId);
}

export async function setMemberRole(
  adminId: string,
  channelId: string,
  targetUserId: string,
  role: ChannelMemberRole,
) {
  await requireAdmin(adminId, channelId);
  if (adminId === targetUserId && role !== ChannelMemberRole.ADMIN) {
    const adminCount = await prisma.channelMember.count({
      where: { channelId, role: ChannelMemberRole.ADMIN },
    });
    if (adminCount <= 1) {
      throw new AppError('Cannot demote the last admin', { statusCode: 400, code: 'LAST_ADMIN' });
    }
  }
  const target = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: targetUserId } },
  });
  if (!target) throw new AppError('Member not found', { statusCode: 404, code: 'NOT_FOUND' });
  await prisma.channelMember.update({
    where: { id: target.id },
    data: { role },
  });
  return listMembers(adminId, channelId);
}

export async function updateChannel(
  adminId: string,
  channelId: string,
  input: { name?: string; description?: string | null; visibility?: ChannelVisibility },
) {
  await requireAdmin(adminId, channelId);
  const data: { name?: string; description?: string | null; visibility?: ChannelVisibility } = {};
  if (input.name !== undefined) {
    const name = normalizeName(input.name);
    if (name.length < 2 || name.length > MAX_NAME_LEN) {
      throw new AppError(`Name must be 2–${MAX_NAME_LEN} characters`, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    data.name = name;
  }
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.visibility !== undefined) data.visibility = input.visibility;

  await prisma.chatChannel.update({ where: { id: channelId }, data });
  return getChannel(adminId, channelId);
}

export async function archiveChannel(adminId: string, channelId: string) {
  await requireAdmin(adminId, channelId);
  await prisma.chatChannel.update({
    where: { id: channelId },
    data: { archivedAt: new Date() },
  });
  return { archived: true };
}

export async function listMembers(userId: string, channelId: string) {
  await requireMembership(userId, channelId);
  const members = await prisma.channelMember.findMany({
    where: { channelId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });
  return members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    role: m.role,
    joinedAt: m.joinedAt,
    muted: Boolean(m.mutedUntil && m.mutedUntil > new Date()),
  }));
}

export async function listMessages(userId: string, channelId: string, after?: string) {
  await requireMembership(userId, channelId);
  const afterDate = after ? new Date(after) : null;

  if (afterDate && !Number.isNaN(afterDate.getTime())) {
    const messages = await prisma.channelMessage.findMany({
      where: {
        channelId,
        deletedAt: null,
        createdAt: { gt: afterDate },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { sender: { select: { id: true, name: true } } },
    });
    return messages.map((m) => ({
      id: m.id,
      channelId: m.channelId,
      senderId: m.senderId,
      senderName: m.sender.name,
      body: m.body,
      createdAt: m.createdAt,
      mine: m.senderId === userId,
    }));
  }

  const latest = await prisma.channelMessage.findMany({
    where: { channelId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { sender: { select: { id: true, name: true } } },
  });
  latest.reverse();
  return latest.map((m) => ({
    id: m.id,
    channelId: m.channelId,
    senderId: m.senderId,
    senderName: m.sender.name,
    body: m.body,
    createdAt: m.createdAt,
    mine: m.senderId === userId,
  }));
}

export async function sendMessage(userId: string, channelId: string, body: string) {
  const member = await requireMembership(userId, channelId);
  if (member.mutedUntil && member.mutedUntil > new Date()) {
    throw new AppError('You are muted in this channel', { statusCode: 403, code: 'MUTED' });
  }
  const text = body.trim();
  if (!text) {
    throw new AppError('Message cannot be empty', { statusCode: 400, code: 'BAD_REQUEST' });
  }
  if (text.length > MAX_MESSAGE_LEN) {
    throw new AppError(`Message must be at most ${MAX_MESSAGE_LEN} characters`, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.channelMessage.create({
      data: { channelId, senderId: userId, body: text },
      include: { sender: { select: { id: true, name: true } } },
    });
    await tx.chatChannel.update({
      where: { id: channelId },
      data: { updatedAt: new Date() },
    });
    return msg;
  });

  return {
    id: message.id,
    channelId: message.channelId,
    senderId: message.senderId,
    senderName: message.sender.name,
    body: message.body,
    createdAt: message.createdAt,
    mine: true,
  };
}

export async function deleteMessage(userId: string, channelId: string, messageId: string) {
  const member = await requireMembership(userId, channelId);
  const message = await prisma.channelMessage.findFirst({
    where: { id: messageId, channelId, deletedAt: null },
  });
  if (!message) throw new AppError('Message not found', { statusCode: 404, code: 'NOT_FOUND' });

  const canModerate =
    member.role === ChannelMemberRole.ADMIN || member.role === ChannelMemberRole.MODERATOR;
  if (message.senderId !== userId && !canModerate) {
    throw new AppError('You can only delete your own messages', { statusCode: 403, code: 'FORBIDDEN' });
  }

  await prisma.channelMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });
  return { deleted: true };
}

export async function searchPlayersForInvite(userId: string, channelId: string, q: string) {
  await requireStaff(userId, channelId);
  const query = q.trim();
  if (query.length < 2) return [];

  const users = await prisma.user.findMany({
    where: {
      suspendedAt: null,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
      ],
      channelMemberships: { none: { channelId } },
    },
    select: { id: true, name: true, email: true },
    take: 20,
  });

  return users.map((u) => ({
    userId: u.id,
    name: u.name,
    email: u.email,
  }));
}
