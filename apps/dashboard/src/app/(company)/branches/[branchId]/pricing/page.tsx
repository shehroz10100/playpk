'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Court = { id: string; name: string; sport: { id: string; name: string } };
type Branch = {
  id: string;
  name: string;
  company: { id: string; name: string };
  courts: Court[];
};

type PricingRule = {
  id: string;
  branchId: string | null;
  courtId: string | null;
  sportId: string | null;
  dayType: string;
  timeRangeStart: string;
  timeRangeEnd: string;
  channel: string;
  priceOverride: number | null;
  priceMultiplier: number | null;
  priority: number;
  active: boolean;
};

type Preview = {
  price: number;
  basePrice: number;
  appliedRuleLabel: string | null;
  preview: string;
};

const emptyForm = {
  dayType: 'WEEKEND',
  timeRangeStart: '17:00',
  timeRangeEnd: '23:00',
  channel: 'BOTH',
  mode: 'multiplier' as 'multiplier' | 'override',
  priceMultiplier: '1.2',
  priceOverride: '',
  priority: '10',
  courtId: '',
  sportId: '',
  active: true,
};

export default function BranchPricingRulesPage() {
  const params = useParams<{ branchId: string }>();
  const branchId = params.branchId;
  const [branch, setBranch] = useState<Branch | null>(null);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: b } = await api<Branch>(`/api/branches/${branchId}`);
    setBranch(b);
    const { data: r } = await api<PricingRule[]>(
      `/api/pricing-rules?companyId=${b.company.id}&branchId=${branchId}`,
    );
    setRules(r);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function loadPreview() {
    if (!branch?.courts[0]) return;
    const courtId = form.courtId || branch.courts[0].id;
    const saturday = nextSaturdayIso();
    const { data } = await api<Preview>(
      `/api/pricing-rules/preview?courtId=${courtId}&date=${saturday}&startTime=19:00&channel=BOTH`,
    );
    setPreview(data);
  }

  useEffect(() => {
    if (branch) void loadPreview().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, form.courtId, rules.length]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!branch) return;
    setSaving(true);
    setError(null);
    try {
      await api('/api/pricing-rules', {
        method: 'POST',
        body: JSON.stringify({
          companyId: branch.company.id,
          branchId,
          courtId: form.courtId || null,
          sportId: form.sportId || null,
          dayType: form.dayType,
          timeRangeStart: form.timeRangeStart,
          timeRangeEnd: form.timeRangeEnd,
          channel: form.channel,
          priceMultiplier:
            form.mode === 'multiplier' ? Number(form.priceMultiplier) : null,
          priceOverride: form.mode === 'override' ? Number(form.priceOverride) : null,
          priority: Number(form.priority) || 0,
          active: form.active,
        }),
      });
      setForm(emptyForm);
      await load();
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setError(null);
    try {
      await api(`/api/pricing-rules/${id}`, { method: 'DELETE' });
      await load();
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  if (!branch) {
    return <p className="text-sm text-muted-foreground">{error ?? 'Loading…'}</p>;
  }

  const sports = [...new Map(branch.courts.map((c) => [c.sport.id, c.sport])).values()];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-brand">
            {branch.company.name}
          </div>
          <h1 className="text-2xl font-semibold text-navy">Pricing rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared engine for online + walk-in. Channel BOTH keeps prices consistent.
          </p>
        </div>
        <Link
          href={`/branches/${branchId}`}
          className="inline-flex h-9 items-center rounded-md border border-border bg-white px-3 text-sm"
        >
          Back to branch
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>{preview.preview}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Base {formatPkr(preview.basePrice)}
            {preview.appliedRuleLabel ? ` · applied ${preview.appliedRuleLabel}` : ' · no rule'}
            {' → '}
            <span className="font-semibold text-navy">{formatPkr(preview.price)}</span>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Create rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onCreate}>
            <div className="space-y-2">
              <Label>Day type</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                value={form.dayType}
                onChange={(e) => setForm((f) => ({ ...f, dayType: e.target.value }))}
              >
                <option value="WEEKDAY">WEEKDAY</option>
                <option value="WEEKEND">WEEKEND</option>
                <option value="HOLIDAY">HOLIDAY</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
              >
                <option value="BOTH">BOTH (recommended)</option>
                <option value="ONLINE">ONLINE only</option>
                <option value="WALK_IN">WALK_IN only</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Time start</Label>
              <Input
                value={form.timeRangeStart}
                onChange={(e) => setForm((f) => ({ ...f, timeRangeStart: e.target.value }))}
                placeholder="17:00"
              />
            </div>
            <div className="space-y-2">
              <Label>Time end</Label>
              <Input
                value={form.timeRangeEnd}
                onChange={(e) => setForm((f) => ({ ...f, timeRangeEnd: e.target.value }))}
                placeholder="23:00"
              />
            </div>
            <div className="space-y-2">
              <Label>Court (optional)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                value={form.courtId}
                onChange={(e) => setForm((f) => ({ ...f, courtId: e.target.value }))}
              >
                <option value="">All courts</option>
                {branch.courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Sport (optional)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                value={form.sportId}
                onChange={(e) => setForm((f) => ({ ...f, sportId: e.target.value }))}
              >
                <option value="">All sports</option>
                {sports.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Override type</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                value={form.mode}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mode: e.target.value as 'multiplier' | 'override',
                  }))
                }
              >
                <option value="multiplier">Multiplier (e.g. 1.2)</option>
                <option value="override">Flat price override</option>
              </select>
            </div>
            {form.mode === 'multiplier' ? (
              <div className="space-y-2">
                <Label>Multiplier</Label>
                <Input
                  value={form.priceMultiplier}
                  onChange={(e) => setForm((f) => ({ ...f, priceMultiplier: e.target.value }))}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Flat price (PKR)</Label>
                <Input
                  value={form.priceOverride}
                  onChange={(e) => setForm((f) => ({ ...f, priceOverride: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Input
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Add rule'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing rules</CardTitle>
          <CardDescription>{rules.length} rule(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules yet — base court price applies.</p>
          ) : (
            rules.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium text-navy">
                    {r.dayType} {r.timeRangeStart}–{r.timeRangeEnd} · {r.channel} · priority{' '}
                    {r.priority}
                  </div>
                  <div className="text-muted-foreground">
                    {r.priceOverride != null
                      ? `Override ${formatPkr(r.priceOverride)}`
                      : `× ${r.priceMultiplier}`}
                    {!r.active ? ' · inactive' : ''}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void onDelete(r.id)}>
                  Delete
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function nextSaturdayIso(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const add = (6 - day + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}
