/** Channel room APIs use static paths + channelId query (dynamic /api/channels/[id] does not match on Vercel). */

export function channelRoomPath(channelId: string): string {
  return `/api/channels/room?channelId=${encodeURIComponent(channelId)}`;
}

export function channelJoinPath(channelId: string): string {
  return `/api/channels/room/join?channelId=${encodeURIComponent(channelId)}`;
}

export function channelLeavePath(channelId: string): string {
  return `/api/channels/room/leave?channelId=${encodeURIComponent(channelId)}`;
}

export function channelMembersPath(channelId: string): string {
  return `/api/channels/room/members?channelId=${encodeURIComponent(channelId)}`;
}

export function channelMembersSearchPath(channelId: string, q: string): string {
  return `/api/channels/room/members/search?channelId=${encodeURIComponent(channelId)}&q=${encodeURIComponent(q)}`;
}

export function channelMemberPath(channelId: string, userId: string): string {
  return `/api/channels/room/members/member?channelId=${encodeURIComponent(channelId)}&userId=${encodeURIComponent(userId)}`;
}

export function channelMessagesPath(channelId: string, after?: string): string {
  const base = `/api/channels/room/messages?channelId=${encodeURIComponent(channelId)}`;
  return after ? `${base}&after=${encodeURIComponent(after)}` : base;
}

export function channelMessagePath(channelId: string, messageId: string): string {
  return `/api/channels/room/messages/message?channelId=${encodeURIComponent(channelId)}&messageId=${encodeURIComponent(messageId)}`;
}
