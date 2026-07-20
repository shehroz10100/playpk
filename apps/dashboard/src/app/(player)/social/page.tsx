'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Heart, MessageCircle, Send } from 'lucide-react';
import type { PlayerSearchHitDto, SocialCommentDto, SocialPostDto } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function SocialPage() {
  const query = useSearchParams();
  const composeRef = useRef<HTMLInputElement>(null);
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

  const loadFeed = useCallback(async () => {
    try {
      const { data } = await api<SocialPostDto[]>(
        `/api/social/feed${likedOnly ? '?starred=1' : ''}`,
      );
      setPosts(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load feed');
    }
  }, [likedOnly]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (query.get('compose') === '1') {
      composeRef.current?.focus();
      composeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [query]);

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

  async function follow(userId: string, currently: boolean) {
    try {
      if (currently) {
        await api(`/api/social/players/${userId}/follow`, { method: 'DELETE' });
      } else {
        await api(`/api/social/players/${userId}/follow`, { method: 'POST' });
      }
      setHits((prev) =>
        prev.map((h) => (h.userId === userId ? { ...h, isFollowing: !currently } : h)),
      );
      setContacts((prev) =>
        prev.map((h) => (h.userId === userId ? { ...h, isFollowing: !currently } : h)),
      );
      await loadFeed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Follow failed');
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

  return (
    <div className="space-y-6 animate-rise">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Community</p>
        <h1 className="font-display mt-1 text-3xl font-extrabold text-navy">Social</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow players, like &amp; comment on posts — just like PlayPro.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-0 shadow-panel">
          <CardHeader>
            <CardTitle className="text-lg">Find players</CardTitle>
            <CardDescription>Search by name, email, or phone — then follow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search players"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="rounded-xl"
              />
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => void search()}>
                Search
              </Button>
            </div>
            <ul className="space-y-2">
              {hits.map((h) => (
                <li
                  key={h.userId}
                  className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium text-navy">{h.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.skillLevel ?? 'No skill yet'} · {h.points} pts
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={h.isFollowing ? 'secondary' : 'outline'}
                    className="rounded-xl"
                    onClick={() => void follow(h.userId, h.isFollowing)}
                  >
                    {h.isFollowing ? 'Following' : 'Follow'}
                  </Button>
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
                  className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium text-navy">{h.name}</div>
                    <Badge variant="secondary">From contacts</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant={h.isFollowing ? 'secondary' : 'outline'}
                    className="rounded-xl"
                    onClick={() => void follow(h.userId, h.isFollowing)}
                  >
                    {h.isFollowing ? 'Following' : 'Follow'}
                  </Button>
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
