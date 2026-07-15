'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { SportDto, TournamentDto } from '@playpk/shared-types';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SportFilterRail } from '@/components/sport-filter-rail';

export default function BranchTournamentsPage() {
  const params = useParams<{ branchId: string }>();
  const branchId = params.branchId;
  const [items, setItems] = useState<TournamentDto[]>([]);
  const [sports, setSports] = useState<SportDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sportId: '',
    format: 'KNOCKOUT',
    entryFee: '1000',
    prizePool: '10000',
    startDate: '',
    endDate: '',
    maxParticipants: '8',
    description: '',
  });

  async function load() {
    const [t, s, allSports] = await Promise.all([
      api<TournamentDto[]>(`/api/tournaments?branchId=${branchId}`),
      api<SportDto[]>(`/api/branches/${branchId}/sports`),
      api<SportDto[]>('/api/sports'),
    ]);
    setItems(t.data);
    const list = s.data.length > 0 ? s.data : allSports.data;
    setSports(list);
    if (!form.sportId && list[0]) {
      setForm((f) => ({ ...f, sportId: list[0].id }));
    }
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [branchId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/tournaments', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          name: form.name,
          sportId: form.sportId,
          format: form.format,
          entryFee: Number(form.entryFee),
          prizePool: Number(form.prizePool) || 0,
          startDate: form.startDate,
          endDate: form.endDate,
          maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : undefined,
          description: form.description || undefined,
          status: 'OPEN',
        }),
      });
      setForm((f) => ({ ...f, name: '', description: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Tournaments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create knockout events, generate brackets, and enter results.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Create tournament</CardTitle>
          <CardDescription>Players can register from the mobile app when status is OPEN.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onCreate}>
            <div className="space-y-2 md:col-span-2">
              <Label>Name</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="DHA Padel Cup"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Sport</Label>
              <SportFilterRail
                sports={sports}
                value={form.sportId}
                onChange={(sportId) => setForm({ ...form, sportId })}
                valueMode="id"
                featuredOnly={false}
                showAll={false}
                size="sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value })}
              >
                <option value="KNOCKOUT">Knockout</option>
                <option value="LEAGUE">League (coming soon)</option>
                <option value="GROUPS">Groups (coming soon)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Entry fee (PKR)</Label>
              <Input
                type="number"
                min={0}
                value={form.entryFee}
                onChange={(e) => setForm({ ...form, entryFee: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Prize pool (PKR)</Label>
              <Input
                type="number"
                min={0}
                value={form.prizePool}
                onChange={(e) => setForm({ ...form, prizePool: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input
                type="date"
                required
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Max participants</Label>
              <Input
                type="number"
                min={2}
                value={form.maxParticipants}
                onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional details"
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create tournament'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branch tournaments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tournaments yet.</p>
          ) : (
            items.map((t) => (
              <Link
                key={t.id}
                href={`/branches/${branchId}/tournaments/${t.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3 hover:bg-muted"
              >
                <div>
                  <div className="font-medium text-navy">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.sport?.name} · {t.format} · {String(t.startDate).slice(0, 10)} →{' '}
                    {String(t.endDate).slice(0, 10)} · {t.registrationCount ?? 0} registered
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted">{formatPkr(t.entryFee)} entry</Badge>
                  <Badge variant="success">{t.status}</Badge>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
