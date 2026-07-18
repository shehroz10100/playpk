'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { PlayerSearchHitDto, SocialPostDto } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SocialPage() {
  const [posts, setPosts] = useState<SocialPostDto[]>([]);
  const [starredOnly, setStarredOnly] = useState(false);
  const [body, setBody] = useState('');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PlayerSearchHitDto[]>([]);
  const [contacts, setContacts] = useState<PlayerSearchHitDto[]>([]);
  const [phoneList, setPhoneList] = useState('+923009876543\n+923001112233');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const { data } = await api<SocialPostDto[]>(
        `/api/social/feed${starredOnly ? '?starred=1' : ''}`,
      );
      setPosts(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load feed');
    }
  }, [starredOnly]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

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

  async function toggleStar(postId: string) {
    try {
      await api(`/api/social/feed/${postId}/star`, { method: 'POST' });
      await loadFeed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Star failed');
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Social</h1>
        <p className="text-sm text-muted-foreground">
          Follow players, star posts, and find friends from your contacts.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Find players</CardTitle>
            <CardDescription>Search by name, email, or phone — then follow or add later in Play.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Search players" value={q} onChange={(e) => setQ(e.target.value)} />
              <Button type="button" variant="outline" onClick={() => void search()}>
                Search
              </Button>
            </div>
            <ul className="space-y-2">
              {hits.map((h) => (
                <li key={h.userId} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium text-navy">{h.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.skillLevel ?? 'No skill yet'} · {h.points} pts
                    </div>
                  </div>
                  <Button size="sm" variant={h.isFollowing ? 'secondary' : 'outline'} onClick={() => void follow(h.userId, h.isFollowing)}>
                    {h.isFollowing ? 'Following' : 'Follow'}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contacts sync</CardTitle>
            <CardDescription>
              Paste phone numbers (demo). We hash them and match PlayPK players — never store raw lists in feed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Phone numbers</Label>
              <textarea
                className="min-h-24 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                value={phoneList}
                onChange={(e) => setPhoneList(e.target.value)}
              />
            </div>
            <Button type="button" disabled={busy} onClick={() => void syncContacts()}>
              {busy ? 'Syncing…' : 'Find friends in contacts'}
            </Button>
            <ul className="space-y-2">
              {contacts.map((h) => (
                <li key={h.userId} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium text-navy">{h.name}</div>
                    <Badge variant="secondary">From contacts</Badge>
                  </div>
                  <Button size="sm" variant={h.isFollowing ? 'secondary' : 'outline'} onClick={() => void follow(h.userId, h.isFollowing)}>
                    {h.isFollowing ? 'Following' : 'Follow'}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg">Activity feed</CardTitle>
            <CardDescription>Posts from you and people you follow. Match results appear here automatically.</CardDescription>
          </div>
          <Button
            size="sm"
            variant={starredOnly ? 'default' : 'outline'}
            onClick={() => setStarredOnly((v) => !v)}
          >
            {starredOnly ? 'Starred only' : 'All posts'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex gap-2" onSubmit={publish}>
            <Input
              placeholder="Share an update…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <Button type="submit" disabled={busy}>
              Post
            </Button>
          </form>
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="rounded-lg border border-border bg-white px-4 py-3">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {p.author.name}
                    {p.author.skillLevel ? ` · ${p.author.skillLevel}` : ''}
                  </span>
                  <span>{new Date(p.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-navy">{p.body}</p>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-brand"
                  onClick={() => void toggleStar(p.id)}
                >
                  {p.starredByMe ? '★ Starred' : '☆ Star'} · {p.starCount}
                </button>
              </li>
            ))}
            {posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No posts yet — follow players or share something.</p>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
