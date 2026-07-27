/** Channel room APIs use static /api/channels/room?channelId=&op= */

function room(channelId: string, op: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ channelId, op, ...extra });
  return `/api/channels/room?${params.toString()}`;
}

export function channelRoomPath(channelId: string): string {
  return room(channelId, 'get');
}

export function channelJoinPath(channelId: string): string {
  return room(channelId, 'join');
}

export function channelLeavePath(channelId: string): string {
  return room(channelId, 'leave');
}

export function channelMembersPath(channelId: string): string {
  return room(channelId, 'members');
}

export function channelMembersSearchPath(channelId: string, q: string): string {
  return room(channelId, 'membersSearch', { q });
}

export function channelMemberPath(channelId: string, userId: string): string {
  return room(channelId, 'member', { userId });
}

export function channelMessagesPath(channelId: string, after?: string): string {
  return after ? room(channelId, 'messages', { after }) : room(channelId, 'messages');
}

export function channelSendPath(channelId: string): string {
  return room(channelId, 'send');
}

export function channelMessagePath(channelId: string, messageId: string): string {
  return room(channelId, 'deleteMessage', { messageId });
}

export function channelArchivePath(channelId: string): string {
  return room(channelId, 'archive');
}

export function channelPatchPath(channelId: string): string {
  return room(channelId, 'patch');
}
