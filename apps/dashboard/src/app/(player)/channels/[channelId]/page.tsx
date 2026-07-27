'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Hash,
  MoreHorizontal,
  Send,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  ChannelInviteHitDto,
  ChannelMemberDto,
  ChannelMessageDto,
  ChatChannelDto,
} from '@playpk/shared-types';
import { ChannelMemberRole, ChannelVisibility } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import {
  channelArchivePath,
  channelLeavePath,
  channelMemberPath,
  channelMembersPath,
  channelMembersSearchPath,
  channelMessagePath,
  channelMessagesPath,
  channelPatchPath,
  channelRoomPath,
  channelSendPath,
} from '@/lib/channel-paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function ChannelRoomPage() {
  const params = useParams<{ channelId: string }>();
  const channelId = params.channelId;
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);
  const [channel, setChannel] = useState<ChatChannelDto | null>(null);
  const [messages, setMessages] = useState<ChannelMessageDto[]>([]);
  const [members, setMembers] = useState<ChannelMemberDto[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<'chat' | 'members' | 'settings'>('chat');
  const [inviteQ, setInviteQ] = useState('');
  const [inviteHits, setInviteHits] = useState<ChannelInviteHitDto[]>([]);
  const me = getStoredUser();

  const isStaff = useMemo(() => {
    const role = channel?.myRole;
    return role === ChannelMemberRole.ADMIN || role === ChannelMemberRole.MODERATOR;
  }, [channel?.myRole]);
  const isAdmin = channel?.myRole === ChannelMemberRole.ADMIN;

  const loadChannel = useCallback(async () => {
    const { data } = await api<ChatChannelDto>(channelRoomPath(channelId));
    setChannel(data);
    if (!data.myRole) {
      throw new ApiError('Join this channel to chat', 403, 'NOT_A_MEMBER');
    }
  }, [channelId]);

  const loadMessages = useCallback(
    async (after?: string) => {
      const { data } = await api<ChannelMessageDto[]>(channelMessagesPath(channelId, after));
      if (after) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const next = data.filter((m) => !seen.has(m.id));
          return next.length ? [...prev, ...next] : prev;
        });
      } else {
        setMessages(data);
      }
    },
    [channelId],
  );

  const loadMembers = useCallback(async () => {
    const { data } = await api<ChannelMemberDto[]>(channelMembersPath(channelId));
    setMembers(data);
  }, [channelId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadChannel();
        await Promise.all([loadMessages(), loadMembers()]);
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to open channel');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadChannel, loadMessages, loadMembers]);

  // Poll for new messages while viewing chat
  useEffect(() => {
    if (panel !== 'chat' || !channel?.myRole) return;
    const id = window.setInterval(() => {
      setMessages((prev) => {
        const last = prev[prev.length - 1]?.createdAt;
        void loadMessages(last ? String(last) : undefined).catch(() => undefined);
        return prev;
      });
    }, 3000);
    return () => window.clearInterval(id);
  }, [panel, channel?.myRole, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const { data } = await api<ChannelMessageDto>(channelSendPath(channelId), {
        method: 'POST',
        body: JSON.stringify({ body: draft }),
      });
      setDraft('');
      setMessages((prev) => [...prev, data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send');
    } finally {
      setBusy(false);
    }
  }

  async function deleteMsg(messageId: string) {
    try {
      await api(channelMessagePath(channelId, messageId), { method: 'DELETE' });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete');
    }
  }

  async function leave() {
    if (!confirm('Leave this channel?')) return;
    try {
      await api(channelLeavePath(channelId), { method: 'POST' });
      router.push('/channels');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to leave');
    }
  }

  async function archive() {
    if (!confirm('Archive this channel for everyone?')) return;
    try {
      await api(channelArchivePath(channelId), { method: 'DELETE' });
      router.push('/channels');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to archive');
    }
  }

  async function searchInvite(q: string) {
    setInviteQ(q);
    if (q.trim().length < 2) {
      setInviteHits([]);
      return;
    }
    try {
      const { data } = await api<ChannelInviteHitDto[]>(
        channelMembersSearchPath(channelId, q.trim()),
      );
      setInviteHits(data);
    } catch {
      setInviteHits([]);
    }
  }

  async function addMember(userId: string) {
    try {
      const { data } = await api<ChannelMemberDto[]>(channelMembersPath(channelId), {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      setMembers(data);
      setInviteHits([]);
      setInviteQ('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add member');
    }
  }

  async function removeMember(userId: string) {
    try {
      const { data } = await api<ChannelMemberDto[]>(channelMemberPath(channelId, userId), {
        method: 'DELETE',
      });
      if (Array.isArray(data)) setMembers(data);
      else router.push('/channels');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove');
    }
  }

  async function setRole(userId: string, role: ChannelMemberRole) {
    try {
      const { data } = await api<ChannelMemberDto[]>(channelMemberPath(channelId, userId), {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setMembers(data);
      await loadChannel();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update role');
    }
  }

  async function saveVisibility(visibility: ChannelVisibility) {
    try {
      const { data } = await api<ChatChannelDto>(channelPatchPath(channelId), {
        method: 'PATCH',
        body: JSON.stringify({ visibility }),
      });
      setChannel(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update');
    }
  }

  if (!channel && !error) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">Opening channel…</div>
    );
  }

  if (error && !channel) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link
          href="/channels"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-navy"
        >
          Back to channels
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/channels"
            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Channels
          </Link>
          <h1 className="flex items-center gap-2 font-display text-xl font-bold text-navy">
            <Hash className="h-5 w-5 text-brand" />
            <span className="truncate">{channel?.name}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {channel?.description ||
              [channel?.sportName, channel?.venueName, channel?.city]
                .filter(Boolean)
                .join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {(
            [
              ['chat', 'Chat'],
              ['members', 'Members'],
              ['settings', 'Manage'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPanel(id)}
              className={cn(
                'cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-bold',
                panel === id ? 'bg-brand/12 text-brand' : 'text-navy/55 hover:text-navy',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {panel === 'chat' ? (
        <>
          <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm">
            <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '52vh' }}>
              {messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No messages yet. Say hello to the room.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn('group flex flex-col', m.mine ? 'items-end' : 'items-start')}
                  >
                    <div className="mb-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-navy/70">{m.senderName}</span>
                      <span>
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {(m.mine || isStaff) && (
                        <button
                          type="button"
                          className="cursor-pointer opacity-0 transition group-hover:opacity-100"
                          aria-label="Delete message"
                          onClick={() => void deleteMsg(m.id)}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </button>
                      )}
                    </div>
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm',
                        m.mine
                          ? 'rounded-br-md bg-brand text-white'
                          : 'rounded-bl-md bg-navy/5 text-navy',
                      )}
                    >
                      {m.body}
                    </div>
                  </div>
                ))
              )}
              <div ref={endRef} />
            </div>
            <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message the channel…"
                className="h-11 rounded-xl"
                maxLength={2000}
              />
              <Button type="submit" className="h-11 rounded-xl px-4" disabled={busy || !draft.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      ) : null}

      {panel === 'members' ? (
        <div className="space-y-4 rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-navy">
            <Users className="h-4 w-4 text-brand" />
            {members.length} members
          </div>

          {isStaff ? (
            <div className="space-y-2 rounded-xl bg-navy/5 p-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-navy/60">
                <UserPlus className="h-3.5 w-3.5" />
                Invite player
              </div>
              <Input
                value={inviteQ}
                onChange={(e) => void searchInvite(e.target.value)}
                placeholder="Search by name, email, or phone"
                className="h-10 rounded-xl"
              />
              {inviteHits.map((h) => (
                <button
                  key={h.userId}
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-sm hover:bg-brand/5"
                  onClick={() => void addMember(h.userId)}
                >
                  <span>
                    <span className="font-semibold text-navy">{h.name}</span>
                    {h.email ? (
                      <span className="ml-2 text-xs text-muted-foreground">{h.email}</span>
                    ) : null}
                  </span>
                  <span className="text-xs font-bold text-brand">Add</span>
                </button>
              ))}
            </div>
          ) : null}

          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-semibold text-navy">
                    {m.name}
                    {m.userId === me?.id ? (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>
                    ) : null}
                  </p>
                  <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {m.role === ChannelMemberRole.ADMIN || m.role === ChannelMemberRole.MODERATOR ? (
                      <Shield className="h-3 w-3 text-brand" />
                    ) : null}
                    {String(m.role).toLowerCase()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && m.userId !== me?.id ? (
                    <select
                      className="h-8 cursor-pointer rounded-lg border border-border bg-white px-2 text-xs"
                      value={String(m.role)}
                      onChange={(e) =>
                        void setRole(m.userId, e.target.value as ChannelMemberRole)
                      }
                    >
                      <option value={ChannelMemberRole.MEMBER}>Member</option>
                      <option value={ChannelMemberRole.MODERATOR}>Moderator</option>
                      <option value={ChannelMemberRole.ADMIN}>Admin</option>
                    </select>
                  ) : null}
                  {(isStaff || m.userId === me?.id) &&
                  !(m.role === ChannelMemberRole.ADMIN && m.userId === me?.id && members.filter((x) => x.role === ChannelMemberRole.ADMIN).length <= 1) ? (
                    <button
                      type="button"
                      className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      title={m.userId === me?.id ? 'Leave' : 'Remove'}
                      onClick={() => void removeMember(m.userId)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {panel === 'settings' ? (
        <div className="space-y-4 rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Your role
            </p>
            <p className="font-semibold text-navy">{String(channel?.myRole ?? '—')}</p>
          </div>
          {isAdmin ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Visibility
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={
                    channel?.visibility === ChannelVisibility.PUBLIC ? 'default' : 'outline'
                  }
                  size="sm"
                  className="rounded-xl"
                  onClick={() => void saveVisibility(ChannelVisibility.PUBLIC)}
                >
                  Public
                </Button>
                <Button
                  type="button"
                  variant={
                    channel?.visibility === ChannelVisibility.INVITE ? 'default' : 'outline'
                  }
                  size="sm"
                  className="rounded-xl"
                  onClick={() => void saveVisibility(ChannelVisibility.INVITE)}
                >
                  Invite-only
                </Button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => void leave()}>
              Leave channel
            </Button>
            {isAdmin ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => void archive()}
              >
                Archive channel
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
