'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Hash, Plus, Search, Users } from 'lucide-react';
import type { ChatChannelDto, SportDto } from '@playpk/shared-types';
import { ChannelKind, ChannelVisibility } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { channelJoinPath } from '@/lib/channel-paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Tab = 'mine' | 'discover' | 'create';

type VenueOption = { id: string; name: string; city: string };

function kindLabel(kind: string) {
  switch (kind) {
    case ChannelKind.SPORT:
      return 'Sport';
    case ChannelKind.VENUE:
      return 'Venue';
    case ChannelKind.AREA:
      return 'Area';
    default:
      return 'General';
  }
}

function ChannelCard({
  channel,
  action,
}: {
  channel: ChatChannelDto;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Hash className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/channels/${channel.id}`}
            className="truncate font-display text-base font-bold text-navy hover:text-brand"
          >
            {channel.name}
          </Link>
          <span className="rounded-full bg-navy/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy/70">
            {kindLabel(String(channel.kind))}
          </span>
          {channel.visibility === ChannelVisibility.INVITE ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              Invite
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
          {channel.description ||
            [channel.sportName, channel.venueName, channel.city || channel.venueCity]
              .filter(Boolean)
              .join(' · ') ||
            'Sport & venue chat'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {channel.memberCount}
          </span>
          {channel.myRole ? (
            <span className="font-semibold uppercase tracking-wide text-brand">
              {String(channel.myRole).toLowerCase()}
            </span>
          ) : null}
          {channel.lastMessage ? (
            <span className="truncate">
              {channel.lastMessage.senderName}: {channel.lastMessage.body}
            </span>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export default function ChannelsPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    searchParams.get('tab') === 'create' ? 'create' : 'mine',
  );
  const [mine, setMine] = useState<ChatChannelDto[]>([]);
  const [discover, setDiscover] = useState<ChatChannelDto[]>([]);
  const [sports, setSports] = useState<SportDto[]>([]);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<ChannelKind>(ChannelKind.SPORT);
  const [visibility, setVisibility] = useState<ChannelVisibility>(ChannelVisibility.PUBLIC);
  const [sportId, setSportId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [city, setCity] = useState('');

  const loadMine = useCallback(async () => {
    try {
      const { data } = await api<ChatChannelDto[]>('/api/channels/mine');
      setMine(data);
      setError(null);
    } catch (err) {
      setMine([]);
      setError(err instanceof ApiError ? err.message : 'Failed to load channels');
    }
  }, []);

  const loadDiscover = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      const { data } = await api<ChatChannelDto[]>(
        `/api/channels/discover${params.toString() ? `?${params}` : ''}`,
      );
      setDiscover(data);
      setError(null);
    } catch (err) {
      setDiscover([]);
      setError(err instanceof ApiError ? err.message : 'Failed to discover channels');
    }
  }, [q]);

  useEffect(() => {
    void loadMine();
    api<SportDto[]>('/api/sports')
      .then((r) => setSports(r.data))
      .catch(() => setSports([]));
    api<VenueOption[]>('/api/venues?pageSize=40')
      .then((r) =>
        setVenues(
          (r.data as Array<{ id: string; name: string; city: string }>).map((v) => ({
            id: v.id,
            name: v.name,
            city: v.city,
          })),
        ),
      )
      .catch(() => setVenues([]));
  }, [loadMine]);

  useEffect(() => {
    if (tab === 'discover') void loadDiscover();
  }, [tab, loadDiscover]);

  async function join(channelId: string) {
    setBusy(true);
    try {
      await api(channelJoinPath(channelId), { method: 'POST' });
      await Promise.all([loadMine(), loadDiscover()]);
      setTab('mine');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not join');
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await api<ChatChannelDto>('/api/channels', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: description || undefined,
          kind,
          visibility,
          sportId: kind === ChannelKind.SPORT || sportId ? sportId || undefined : undefined,
          branchId: kind === ChannelKind.VENUE ? branchId || undefined : undefined,
          city: kind === ChannelKind.AREA ? city || undefined : city || undefined,
        }),
      });
      setName('');
      setDescription('');
      setTab('mine');
      await loadMine();
      window.location.href = `/channels/${data.id}`;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create channel');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-navy">
            Channels
          </h1>
          <p className="text-sm text-muted-foreground">
            Discord-style rooms for sports, venues, and areas. Creators are admins.
          </p>
        </div>
        <Button
          type="button"
          className="gap-1.5 rounded-xl"
          onClick={() => setTab('create')}
        >
          <Plus className="h-4 w-4" />
          New channel
        </Button>
      </div>

      <div className="flex gap-1 rounded-xl bg-navy/5 p-1">
        {(
          [
            ['mine', 'My channels'],
            ['discover', 'Discover'],
            ['create', 'Create'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold transition',
              tab === id ? 'bg-white text-navy shadow-sm' : 'text-navy/60 hover:text-navy',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {tab === 'mine' ? (
        <div className="space-y-3">
          {mine.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-navy/15 bg-white p-8 text-center">
              <p className="font-semibold text-navy">No channels yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a room or discover public channels to join.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button type="button" variant="outline" onClick={() => setTab('discover')}>
                  Discover
                </Button>
                <Button type="button" onClick={() => setTab('create')}>
                  Create
                </Button>
              </div>
            </div>
          ) : (
            mine.map((c) => (
              <ChannelCard
                key={c.id}
                channel={c}
                action={
                  <Link
                    href={`/channels/${c.id}`}
                    className="shrink-0 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white"
                  >
                    Open
                  </Link>
                }
              />
            ))
          )}
        </div>
      ) : null}

      {tab === 'discover' ? (
        <div className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void loadDiscover();
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search public channels"
                className="h-11 rounded-xl pl-9"
              />
            </div>
            <Button type="submit" variant="outline" className="rounded-xl">
              Search
            </Button>
          </form>
          {discover.length === 0 ? (
            <p className="text-sm text-muted-foreground">No public channels to join right now.</p>
          ) : (
            discover.map((c) => (
              <ChannelCard
                key={c.id}
                channel={c}
                action={
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    disabled={busy}
                    onClick={() => void join(c.id)}
                  >
                    Join
                  </Button>
                }
              />
            ))
          )}
        </div>
      ) : null}

      {tab === 'create' ? (
        <form
          onSubmit={onCreate}
          className="space-y-4 rounded-2xl border border-navy/10 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="ch-name">Channel name</Label>
            <Input
              id="ch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lahore Cricket Night"
              className="h-11 rounded-xl"
              required
              minLength={2}
              maxLength={64}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-desc">Description</Label>
            <Input
              id="ch-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pickup games, tips, and meetups"
              className="h-11 rounded-xl"
              maxLength={280}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ch-kind">Type</Label>
              <select
                id="ch-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as ChannelKind)}
                className="flex h-11 w-full cursor-pointer rounded-xl border border-border bg-white px-3 text-sm"
              >
                <option value={ChannelKind.SPORT}>Sport</option>
                <option value={ChannelKind.VENUE}>Venue</option>
                <option value={ChannelKind.AREA}>Area / city</option>
                <option value={ChannelKind.GENERAL}>General</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-vis">Visibility</Label>
              <select
                id="ch-vis"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as ChannelVisibility)}
                className="flex h-11 w-full cursor-pointer rounded-xl border border-border bg-white px-3 text-sm"
              >
                <option value={ChannelVisibility.PUBLIC}>Public — anyone can join</option>
                <option value={ChannelVisibility.INVITE}>Invite-only</option>
              </select>
            </div>
          </div>
          {kind === ChannelKind.SPORT || kind === ChannelKind.GENERAL ? (
            <div className="space-y-1.5">
              <Label htmlFor="ch-sport">Sport {kind === ChannelKind.SPORT ? '' : '(optional)'}</Label>
              <select
                id="ch-sport"
                value={sportId}
                onChange={(e) => setSportId(e.target.value)}
                required={kind === ChannelKind.SPORT}
                className="flex h-11 w-full cursor-pointer rounded-xl border border-border bg-white px-3 text-sm"
              >
                <option value="">Select sport</option>
                {sports.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {kind === ChannelKind.VENUE ? (
            <div className="space-y-1.5">
              <Label htmlFor="ch-venue">Venue</Label>
              <select
                id="ch-venue"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="flex h-11 w-full cursor-pointer rounded-xl border border-border bg-white px-3 text-sm"
              >
                <option value="">Select venue</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.city}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {kind === ChannelKind.AREA ? (
            <div className="space-y-1.5">
              <Label htmlFor="ch-city">City / area</Label>
              <Input
                id="ch-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Lahore"
                className="h-11 rounded-xl"
                required
              />
            </div>
          ) : null}
          <Button type="submit" className="w-full rounded-xl" disabled={busy}>
            {busy ? 'Creating…' : 'Create channel — you will be admin'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
