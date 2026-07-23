'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Heart, MessageCircle, Send, UserPlus, Users } from 'lucide-react';
import type {
  DirectMessageDto,
  DirectThreadDto,
  PlayerSearchHitDto,
  SocialCommentDto,
  SocialConnectionDto,
  SocialPostDto,
} from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type NetworkTab = 'following' | 'followers' | 'requests' | 'chats';

export default function SocialPage() {
  const query = useSearchParams();
  const composeRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState<SocialPostDto[]>([]);
  const [likedOnly, setLikedOnly] = useState(false);
  const [body, setBody] = useState('');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PlayerSearchHitDto[]>([]);
  const [contacts, setContacts] = useState<PlayerSearchHitDto[]>([]);
  const [phoneList, setPhoneList] = useState('+923009876543\n+923001112233');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, SocialCommentDto[]>>({});
  const [draftComment, setDraftComment] = useState<Record<string, string>>({});

  const [networkTab, setNetworkTab] = useState<NetworkTab>('following');
  const [following, setFollowing] = useState<SocialConnectionDto[]>([]);
  const [followers, setFollowers] = useState<SocialConnectionDto[]>([]);
  const [requests, setRequests] = useState<SocialConnectionDto[]>([]);
  const [threads, setThreads] = useState<DirectThreadDto[]>([]);
  const [activeThread, setActiveThread] = useState<DirectThreadDto | null>(null);
  const [messages, setMessages] = useState<DirectMessageDto[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const { data } = await api<SocialPostDto[]>(
        `/api/social/feed${likedOnly ? '?starred=1' : ''}`,
      );
      setPosts(data);
      setError(null);
    } catch (err) {
      setPosts([]);
      setError(err instanceof ApiError ? err.message : 'Failed to load feed');
    }
  }, [likedOnly]);

  const loadNetwork = useCallback(async () => {
    const results = await Promise.allSettled([
      api<SocialConnectionDto[]>('/api/social/following'),
      api<SocialConnectionDto[]>('/api/social/followers'),
      api<SocialConnectionDto[]>('/api/social/follow-requests'),
      api<DirectThreadDto[]>('/api/social/chats'),
    ]);

    const errors: string[] = [];
    if (results[0].status === 'fulfilled') setFollowing(results[0].value.data);
    else {
      errors.push('following');
      console.error(results[0].reason);
    }
    if (results[1].status === 'fulfilled') setFollowers(results[1].value.data);
    else errors.push('followers');
    if (results[2].status === 'fulfilled') setRequests(results[2].value.data);
    else errors.push('requests');
    if (results[3].status === 'fulfilled') setThreads(results[3].value.data);
    else errors.push('chats');

    if (errors.length === 4) {
      setError(
        'Could not load your network. The API may need a redeploy/migration — try refresh in a minute.',
      );
    } else if (errors.length > 0) {
      setError(`Some network lists failed to load (${errors.join(', ')}).`);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    void loadNetwork();
  }, [loadNetwork]);

  useEffect(() => {
    if (query.get('compose') === '1') {
      composeRef.current?.focus();
      composeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [query]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeThread?.id]);

  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/social/feed', {
        method: 'POST',
        body: JSON.stringify({ body: body.trim() }),
      });
      setBody('');
      await loadFeed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not post');
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike(postId: string) {
    try {
      await api(`/api/social/feed/${postId}/like`, { method: 'POST' });
      await loadFeed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Like failed');
    }
  }

  async function toggleComments(postId: string) {
    const next = !openComments[postId];
    setOpenComments((prev) => ({ ...prev, [postId]: next }));
    if (next && !comments[postId]) {
      try {
        const { data } = await api<SocialCommentDto[]>(`/api/social/feed/${postId}/comments`);
        setComments((prev) => ({ ...prev, [postId]: data }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load comments');
      }
    }
  }

  async function submitComment(postId: string) {
    const text = (draftComment[postId] ?? '').trim();
    if (!text) return;
    try {
      const { data } = await api<SocialCommentDto>(`/api/social/feed/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      });
      setComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] ?? []), data],
      }));
      setDraftComment((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, commentCount: (p.commentCount ?? 0) + 1 } : p,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Comment failed');
    }
  }

  async function search() {
    if (q.trim().length < 2) return;
    try {
      const { data } = await api<PlayerSearchHitDto[]>(
        `/api/social/players/search?q=${encodeURIComponent(q.trim())}`,
      );
      setHits(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed');
    }
  }

  function patchHit(userId: string, patch: Partial<PlayerSearchHitDto>) {
    setHits((prev) => prev.map((h) => (h.userId === userId ? { ...h, ...patch } : h)));
    setContacts((prev) => prev.map((h) => (h.userId === userId ? { ...h, ...patch } : h)));
  }

  async function follow(userId: string, currentlyFollowing: boolean, followStatus?: string) {
    const hit =
      hits.find((h) => h.userId === userId) ?? contacts.find((h) => h.userId === userId) ?? null;
    try {
      setError(null);
      if (currentlyFollowing || followStatus === 'PENDING') {
        await api(`/api/social/players/${userId}/follow`, { method: 'DELETE' });
        patchHit(userId, {
          isFollowing: false,
          followStatus: 'NONE',
          canChat: Boolean(hit?.followsMe),
        });
        setFollowing((prev) => prev.filter((p) => p.userId !== userId));
      } else {
        const { data } = await api<{ following: boolean; followStatus: 'PENDING' | 'ACCEPTED' }>(
          `/api/social/players/${userId}/follow`,
          { method: 'POST' },
        );
        const accepted = data.following || data.followStatus === 'ACCEPTED' || !data.followStatus;
        patchHit(userId, {
          isFollowing: accepted,
          followStatus: accepted ? 'ACCEPTED' : data.followStatus,
          canChat: accepted || Boolean(hit?.followsMe),
        });
        if (accepted && hit) {
          setFollowing((prev) => {
            if (prev.some((p) => p.userId === userId)) return prev;
            return [
              {
                userId: hit.userId,
                name: hit.name,
                email: hit.email,
                phone: hit.phone,
                skillLevel: hit.skillLevel,
                points: hit.points,
                followStatus: 'ACCEPTED',
                followsMe: Boolean(hit.followsMe),
                isFollowing: true,
                canChat: true,
                since: new Date().toISOString(),
              },
              ...prev,
            ];
          });
          setNetworkTab('following');
        }
      }
      await Promise.all([loadFeed(), loadNetwork()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Follow failed');
    }
  }

  async function acceptRequest(userId: string) {
    try {
      await api(`/api/social/follow-requests/${userId}/accept`, { method: 'POST' });
      await loadNetwork();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept request');
    }
  }

  async function declineRequest(userId: string) {
    try {
      await api(`/api/social/follow-requests/${userId}/decline`, { method: 'POST' });
      await loadNetwork();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not decline request');
    }
  }

  async function openChat(userId: string) {
    setChatBusy(true);
    setError(null);
    try {
      const { data } = await api<DirectThreadDto>(`/api/social/chats/${userId}`, {
        method: 'POST',
      });
      setActiveThread(data);
      setNetworkTab('chats');
      const msgs = await api<DirectMessageDto[]>(`/api/social/chats/thread/${data.id}/messages`);
      setMessages(msgs.data);
      await loadNetwork();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open chat');
    } finally {
      setChatBusy(false);
    }
  }

  async function selectThread(thread: DirectThreadDto) {
    setActiveThread(thread);
    setNetworkTab('chats');
    try {
      const { data } = await api<DirectMessageDto[]>(
        `/api/social/chats/thread/${thread.id}/messages`,
      );
      setMessages(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load messages');
    }
  }

  async function sendChat(e?: FormEvent) {
    e?.preventDefault();
    if (!activeThread || !chatDraft.trim()) return;
    const text = chatDraft.trim();
    setChatDraft('');
    try {
      const { data } = await api<DirectMessageDto>(
        `/api/social/chats/thread/${activeThread.id}/messages`,
        { method: 'POST', body: JSON.stringify({ body: text }) },
      );
      setMessages((prev) => [...prev, data]);
      await loadNetwork();
    } catch (err) {
      setChatDraft(text);
      setError(err instanceof ApiError ? err.message : 'Could not send message');
    }
  }

  async function syncContacts() {
    const phones = phoneList
      .split(/[\n,]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    setBusy(true);
    setError(null);
    try {
      const { data } = await api<PlayerSearchHitDto[]>('/api/social/contacts/sync', {
        method: 'POST',
        body: JSON.stringify({ phones }),
      });
      setContacts(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Contacts sync failed');
    } finally {
      setBusy(false);
    }
  }

  function followLabel(h: { isFollowing: boolean; followStatus?: string }) {
    if (h.isFollowing || h.followStatus === 'ACCEPTED') return 'Following';
    if (h.followStatus === 'PENDING') return 'Requested';
    return 'Follow';
  }

  const networkTabs: Array<{ id: NetworkTab; label: string; count: number }> = [
    { id: 'following', label: 'Following', count: following.length },
    { id: 'followers', label: 'Followers', count: followers.length },
    { id: 'requests', label: 'Requests', count: requests.length },
    { id: 'chats', label: 'Chats', count: threads.length },
  ];

  return (
    <div className="space-y-6 animate-rise">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Community</p>
        <h1 className="font-display mt-1 text-3xl font-bold uppercase tracking-tight text-navy">
          Social
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow players, manage requests, and chat with your network.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card className="rounded-2xl border-0 shadow-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-brand" />
            Your network
          </CardTitle>
          <CardDescription>
            See who you follow, who follows you, pending requests, and open chats.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {networkTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setNetworkTab(tab.id)}
                className={cn(
                  'shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition',
                  networkTab === tab.id
                    ? 'bg-navy text-white'
                    : 'bg-muted text-navy/70 hover:bg-brand/10',
                )}
              >
                {tab.label}
                <span className="ml-1.5 opacity-70">{tab.count}</span>
              </button>
            ))}
          </div>

          {networkTab === 'following' ? (
            <ConnectionList
              empty="You are not following anyone yet — search below to find players."
              items={following}
              onUnfollow={(id) => void follow(id, true, 'ACCEPTED')}
              onChat={(id) => void openChat(id)}
              chatBusy={chatBusy}
            />
          ) : null}

          {networkTab === 'followers' ? (
            <ConnectionList
              empty="No followers yet. When someone follows you and you accept, they show up here."
              items={followers}
              onFollowBack={(id, isFollowing) => void follow(id, isFollowing)}
              onChat={(id) => void openChat(id)}
              chatBusy={chatBusy}
              showFollowBack
            />
          ) : null}

          {networkTab === 'requests' ? (
            <ul className="space-y-2">
              {requests.map((r) => (
                <li
                  key={r.userId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5 text-sm"
                >
                  <div>
                    <div className="font-medium text-navy">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.skillLevel ?? 'No skill yet'} · {r.points} pts · wants to follow you
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl"
                      onClick={() => void acceptRequest(r.userId)}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => void declineRequest(r.userId)}
                    >
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
              {requests.length === 0 ? (
                <p className="rounded-xl border border-dashed border-navy/15 px-4 py-8 text-center text-sm text-muted-foreground">
                  No pending follow requests.
                </p>
              ) : null}
            </ul>
          ) : null}

          {networkTab === 'chats' ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,14rem)_1fr]">
              <ul className="space-y-1.5">
                {threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => void selectThread(t)}
                      className={cn(
                        'w-full rounded-xl px-3 py-2.5 text-left text-sm transition',
                        activeThread?.id === t.id
                          ? 'bg-brand/15 text-navy'
                          : 'bg-muted/50 hover:bg-muted',
                      )}
                    >
                      <div className="font-semibold">{t.otherUser.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {t.lastMessage?.body ?? 'No messages yet'}
                      </div>
                    </button>
                  </li>
                ))}
                {threads.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No chats yet. Tap Chat on a follower or someone you follow.
                  </p>
                ) : null}
              </ul>

              <div className="flex min-h-[16rem] flex-col rounded-2xl border border-border/70 bg-white">
                {activeThread ? (
                  <>
                    <div className="border-b border-border/60 px-3 py-2.5 text-sm font-bold text-navy">
                      {activeThread.otherUser.name}
                      {activeThread.otherUser.skillLevel ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {activeThread.otherUser.skillLevel}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                            m.mine
                              ? 'ml-auto bg-brand text-white'
                              : 'bg-muted text-navy',
                          )}
                        >
                          {m.body}
                          <div
                            className={cn(
                              'mt-1 text-[10px]',
                              m.mine ? 'text-white/70' : 'text-muted-foreground',
                            )}
                          >
                            {new Date(m.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                    <form
                      className="flex gap-2 border-t border-border/60 p-2.5"
                      onSubmit={(e) => void sendChat(e)}
                    >
                      <Input
                        placeholder="Write a message…"
                        value={chatDraft}
                        onChange={(e) => setChatDraft(e.target.value)}
                        className="rounded-xl"
                      />
                      <Button type="submit" size="sm" className="rounded-xl" disabled={chatBusy}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    Select a conversation or start one from Following / Followers.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-0 shadow-panel">
          <CardHeader>
            <CardTitle className="text-lg">Find players</CardTitle>
            <CardDescription>
              Search by name, email, or phone — then send a follow request.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search players"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void search();
                  }
                }}
              />
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => void search()}>
                Search
              </Button>
            </div>
            <ul className="space-y-2">
              {hits.map((h) => (
                <li
                  key={h.userId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium text-navy">{h.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.skillLevel ?? 'No skill yet'} · {h.points} pts
                      {h.followsMe ? ' · Follows you' : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {h.canChat ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        disabled={chatBusy}
                        onClick={() => void openChat(h.userId)}
                      >
                        <MessageCircle className="mr-1 h-3.5 w-3.5" />
                        Chat
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant={h.isFollowing || h.followStatus === 'PENDING' ? 'secondary' : 'outline'}
                      className="rounded-xl"
                      onClick={() => void follow(h.userId, h.isFollowing, h.followStatus)}
                    >
                      {followLabel(h)}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-panel">
          <CardHeader>
            <CardTitle className="text-lg">Contacts sync</CardTitle>
            <CardDescription>Paste phones to find friends already on PlayPK.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Phone numbers</Label>
              <textarea
                className="min-h-24 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
                value={phoneList}
                onChange={(e) => setPhoneList(e.target.value)}
              />
            </div>
            <Button type="button" disabled={busy} className="rounded-xl" onClick={() => void syncContacts()}>
              {busy ? 'Syncing…' : 'Find friends in contacts'}
            </Button>
            <ul className="space-y-2">
              {contacts.map((h) => (
                <li
                  key={h.userId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium text-navy">{h.name}</div>
                    <Badge variant="secondary">From contacts</Badge>
                  </div>
                  <div className="flex gap-2">
                    {h.canChat ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        disabled={chatBusy}
                        onClick={() => void openChat(h.userId)}
                      >
                        Chat
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant={h.isFollowing || h.followStatus === 'PENDING' ? 'secondary' : 'outline'}
                      className="rounded-xl"
                      onClick={() => void follow(h.userId, h.isFollowing, h.followStatus)}
                    >
                      {followLabel(h)}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-0 shadow-panel">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg">Activity feed</CardTitle>
            <CardDescription>Like and comment on updates from your network.</CardDescription>
          </div>
          <Button
            size="sm"
            variant={likedOnly ? 'default' : 'outline'}
            className="rounded-xl"
            onClick={() => setLikedOnly((v) => !v)}
          >
            {likedOnly ? 'Liked only' : 'All posts'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex gap-2" onSubmit={publish}>
            <Input
              ref={composeRef}
              placeholder="Share an update…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="rounded-xl"
            />
            <Button type="submit" disabled={busy} className="rounded-xl">
              Post
            </Button>
          </form>
          <ul className="space-y-3">
            {posts.map((p) => {
              const liked = p.likedByMe ?? p.starredByMe;
              const likes = p.likeCount ?? p.starCount;
              const commentCount = p.commentCount ?? 0;
              return (
                <li key={p.id} className="rounded-2xl border border-border/70 bg-white px-4 py-3">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-navy">
                      {p.author.name}
                      {p.author.skillLevel ? (
                        <span className="font-normal text-muted-foreground">
                          {' '}
                          · {p.author.skillLevel}
                        </span>
                      ) : null}
                    </span>
                    <span>{new Date(p.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-navy">{p.body}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition',
                        liked ? 'bg-brand/10 text-brand' : 'bg-muted text-navy/70 hover:bg-brand/5',
                      )}
                      onClick={() => void toggleLike(p.id)}
                    >
                      <Heart className={cn('h-3.5 w-3.5', liked && 'fill-brand')} />
                      Like · {likes}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-xs font-bold text-navy/70 hover:bg-brand/5"
                      onClick={() => void toggleComments(p.id)}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Comment · {commentCount}
                    </button>
                  </div>

                  {openComments[p.id] ? (
                    <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                      {(comments[p.id] ?? []).map((c) => (
                        <div key={c.id} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                          <div className="text-xs font-semibold text-navy">{c.author.name}</div>
                          <p className="text-navy/80">{c.body}</p>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Write a comment…"
                          value={draftComment[p.id] ?? ''}
                          onChange={(e) =>
                            setDraftComment((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          className="rounded-xl"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void submitComment(p.id);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => void submitComment(p.id)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
            {posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No posts yet — follow players or share something.
              </p>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionList({
  items,
  empty,
  onUnfollow,
  onFollowBack,
  onChat,
  chatBusy,
  showFollowBack,
}: {
  items: SocialConnectionDto[];
  empty: string;
  onUnfollow?: (userId: string) => void;
  onFollowBack?: (userId: string, isFollowing: boolean) => void;
  onChat: (userId: string) => void;
  chatBusy: boolean;
  showFollowBack?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-navy/15 px-4 py-8 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((p) => (
        <li
          key={p.userId}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5 text-sm"
        >
          <div>
            <div className="font-medium text-navy">{p.name}</div>
            <div className="text-xs text-muted-foreground">
              {p.skillLevel ?? 'No skill yet'} · {p.points} pts
              {p.followStatus === 'PENDING' ? ' · Requested' : ''}
              {p.followsMe && p.isFollowing ? ' · Mutual' : ''}
            </div>
          </div>
          <div className="flex gap-2">
            {p.canChat ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={chatBusy}
                onClick={() => onChat(p.userId)}
              >
                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                Chat
              </Button>
            ) : null}
            {showFollowBack ? (
              <Button
                size="sm"
                variant={p.isFollowing ? 'secondary' : 'default'}
                className="rounded-xl"
                onClick={() => onFollowBack?.(p.userId, p.isFollowing)}
              >
                {p.isFollowing ? (
                  'Following'
                ) : (
                  <>
                    <UserPlus className="mr-1 h-3.5 w-3.5" />
                    Follow back
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="rounded-xl"
                onClick={() => onUnfollow?.(p.userId)}
              >
                {p.followStatus === 'PENDING' ? 'Requested' : 'Following'}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
