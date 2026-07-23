'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Percent, Pencil, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Sport = { id: string; name: string };

type Discount = {
  id: string;
  companyId: string;
  sportId: string;
  sportName: string;
  percentOff: number;
  label: string | null;
  active: boolean;
};

type Company = {
  id: string;
  name: string;
  branches: Array<{
    id: string;
    courts?: Array<{ sport: Sport }>;
  }>;
};

type BranchDetail = {
  id: string;
  courts: Array<{ sport: Sport }>;
};

export default function CompanySportDiscountsPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [companyName, setCompanyName] = useState('');
  const [sports, setSports] = useState<Sport[]>([]);
  const [rows, setRows] = useState<Discount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    sportId: '',
    percentOff: '20',
    label: '',
    active: true,
  });

  async function load() {
    const { data: company } = await api<Company>(`/api/companies/${companyId}`);
    setCompanyName(company.name);

    const branchSports: Sport[] = [];
    await Promise.all(
      (company.branches ?? []).map(async (b) => {
        try {
          const { data } = await api<BranchDetail>(`/api/branches/${b.id}`);
          for (const c of data.courts ?? []) {
            branchSports.push(c.sport);
          }
        } catch {
          /* branch may lack courts */
        }
      }),
    );

    const uniqueSports = [...new Map(branchSports.map((s) => [s.id, s])).values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    setSports(uniqueSports);

    const { data: discounts } = await api<Discount[]>(
      `/api/sport-discounts?companyId=${companyId}`,
    );
    setRows(discounts);
    if (!form.sportId && uniqueSports[0]) {
      setForm((f) => ({ ...f, sportId: uniqueSports[0].id }));
    }
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const usedSportIds = useMemo(() => new Set(rows.map((r) => r.sportId)), [rows]);
  const availableSports = sports.filter(
    (s) => !usedSportIds.has(s.id) || s.id === form.sportId,
  );

  function startEdit(row: Discount) {
    setEditingId(row.id);
    setForm({
      sportId: row.sportId,
      percentOff: String(row.percentOff),
      label: row.label ?? '',
      active: row.active,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      sportId: availableSports[0]?.id ?? sports[0]?.id ?? '',
      percentOff: '20',
      label: '',
      active: true,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const percentOff = Number(form.percentOff);
    if (!form.sportId || !Number.isFinite(percentOff) || percentOff < 1 || percentOff > 90) {
      setError('Choose a sport and a discount between 1% and 90%.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api(`/api/sport-discounts/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            percentOff,
            label: form.label.trim() || null,
            active: form.active,
          }),
        });
      } else {
        await api('/api/sport-discounts', {
          method: 'POST',
          body: JSON.stringify({
            companyId,
            sportId: form.sportId,
            percentOff,
            label: form.label.trim() || null,
            active: form.active,
          }),
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save discount');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id: string) {
    if (!confirm('Remove this sport discount?')) return;
    setError(null);
    try {
      await api(`/api/sport-discounts/${id}`, { method: 'DELETE' });
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove discount');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-brand">
            {companyName || 'Company'}
          </div>
          <h1 className="text-2xl font-semibold text-navy">Sport discounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Offer % off on sports like Cricket or Futsal. Deals appear on Discover venue cards and
            apply when players book.
          </p>
        </div>
        <Link
          href={`/companies/${companyId}`}
          className="inline-flex h-9 items-center rounded-md border border-border bg-white px-3 text-sm"
        >
          Back to company
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Percent className="h-5 w-5 text-brand" />
            {editingId ? 'Edit discount' : 'Add discount'}
          </CardTitle>
          <CardDescription>
            Example: 20% off Futsal for all branches under this company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-2">
              <Label>Sport</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                value={form.sportId}
                disabled={Boolean(editingId)}
                onChange={(e) => setForm((f) => ({ ...f, sportId: e.target.value }))}
              >
                {(editingId ? sports : availableSports).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Percent off</Label>
              <Input
                type="number"
                min={1}
                max={90}
                step={1}
                value={form.percentOff}
                onChange={(e) => setForm((f) => ({ ...f, percentOff: e.target.value }))}
                placeholder="20"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Label (optional)</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Weekend deal"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-navy">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Active (visible to players)
            </label>
            <div className="flex flex-wrap items-end gap-2 md:justify-end">
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={saving || sports.length === 0}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add discount'}
              </Button>
            </div>
          </form>
          {sports.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Add courts with sports at a branch first, then return here to set discounts.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current discounts</CardTitle>
          <CardDescription>{rows.length} sport offer(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No discounts yet.</p>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-3"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-navy">{r.sportName}</span>
                    <Badge className="bg-brand text-white hover:bg-brand">{r.percentOff}% OFF</Badge>
                    {!r.active ? <Badge variant="secondary">Inactive</Badge> : null}
                  </div>
                  {r.label ? (
                    <p className="mt-1 text-xs text-muted-foreground">{r.label}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => startEdit(r)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-red-600"
                    onClick={() => void onRemove(r.id)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
