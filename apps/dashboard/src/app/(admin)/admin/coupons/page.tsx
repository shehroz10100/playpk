'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Company = { id: string; name: string };
type Coupon = {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  validFrom: string;
  validTo: string;
  usageLimit: number | null;
  usageCount: number;
  active: boolean;
  company: { id: string; name: string };
};

export default function AdminCouponsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    companyId: '',
    code: '',
    discountType: 'PERCENTAGE',
    discountValue: '10',
    validFrom: '',
    validTo: '',
    usageLimit: '100',
  });

  async function load() {
    const [c, q] = await Promise.all([
      api<Company[]>('/api/admin/companies'),
      api<Coupon[]>('/api/admin/coupons'),
    ]);
    setCompanies(c.data.map((x) => ({ id: x.id, name: x.name })));
    setCoupons(q.data);
    if (!form.companyId && c.data[0]) {
      setForm((f) => ({ ...f, companyId: c.data[0].id }));
    }
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          companyId: form.companyId,
          code: form.code,
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          validFrom: form.validFrom,
          validTo: form.validTo,
          usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        }),
      });
      setForm((f) => ({ ...f, code: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    try {
      await api(`/api/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !coupon.active }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Coupon management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and activate promotional codes for any venue company.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Create coupon</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onCreate}>
            <div className="space-y-2">
              <Label>Company</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={form.companyId}
                onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                required
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="PLAY10"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed PKR</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                type="number"
                min={1}
                required
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valid from</Label>
              <Input
                type="date"
                required
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valid to</Label>
              <Input
                type="date"
                required
                value={form.validTo}
                onChange={(e) => setForm({ ...form, validTo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Usage limit</Label>
              <Input
                type="number"
                min={1}
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Create coupon'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All coupons</CardTitle>
          <CardDescription>{coupons.length} codes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {coupons.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3 text-sm"
            >
              <div>
                <div className="font-semibold text-navy">
                  {c.code}{' '}
                  <Badge variant={c.active ? 'success' : 'muted'}>
                    {c.active ? 'Active' : 'Off'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.company.name} · {c.discountType} {c.discountValue} · used {c.usageCount}
                  {c.usageLimit != null ? `/${c.usageLimit}` : ''} ·{' '}
                  {String(c.validFrom).slice(0, 10)} → {String(c.validTo).slice(0, 10)}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => toggleActive(c)}>
                {c.active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
