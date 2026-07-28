'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Branding = {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  businessName: string | null;
  receiptFooterText: string | null;
};

export default function CompanyBrandingPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [form, setForm] = useState<Branding>({
    logoUrl: null,
    primaryColor: '#00A651',
    secondaryColor: '#0B1F3A',
    businessName: null,
    receiptFooterText: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ branding: Branding }>(`/api/branding/companies/${companyId}`)
      .then(({ data }) => {
        setForm({
          logoUrl: data.branding.logoUrl,
          primaryColor: data.branding.primaryColor ?? '#00A651',
          secondaryColor: data.branding.secondaryColor ?? '#0B1F3A',
          businessName: data.branding.businessName,
          receiptFooterText: data.branding.receiptFooterText,
        });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [companyId]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api(`/api/branding/companies/${companyId}`, {
        method: 'PUT',
        body: JSON.stringify({
          logoUrl: form.logoUrl?.trim() || null,
          primaryColor: form.primaryColor,
          secondaryColor: form.secondaryColor,
          businessName: form.businessName?.trim() || null,
          receiptFooterText: form.receiptFooterText?.trim() || null,
        }),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading branding…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Branding</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            White-label appearance for the walk-in desk header and receipts.
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
      {saved ? (
        <p className="rounded-md border border-brand/30 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Saved. Walk-in desk will show these colors and business name on next load.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Logo URL, colors, and receipt footer.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSave}>
              <div className="space-y-2">
                <Label>Business display name</Label>
                <Input
                  value={form.businessName ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                  placeholder="GameOn Sports"
                />
              </div>
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input
                  value={form.logoUrl ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary color</Label>
                  <Input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secondary color</Label>
                  <Input
                    type="color"
                    value={form.secondaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Receipt footer</Label>
                <Input
                  value={form.receiptFooterText ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, receiptFooterText: e.target.value }))}
                  placeholder="Thank you for playing…"
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save branding'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>Approximate walk-in header + receipt.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-xl p-4 text-white"
              style={{
                background: `linear-gradient(120deg, ${form.primaryColor}, ${form.secondaryColor})`,
              }}
            >
              <div className="flex items-center gap-3">
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logoUrl} alt="" className="h-10 w-10 rounded bg-white/20 object-contain" />
                ) : null}
                <div>
                  <div className="text-lg font-semibold">
                    {form.businessName?.trim() || 'Your venue name'}
                  </div>
                  <div className="text-xs text-white/80">Walk-in desk</div>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-border p-4 text-center text-sm">
              <div className="font-semibold" style={{ color: form.primaryColor }}>
                {form.businessName?.trim() || 'Your venue name'}
              </div>
              <p className="mt-2 text-muted-foreground">Sample receipt</p>
              <p className="mt-4 text-xs text-muted-foreground">
                {form.receiptFooterText || 'Receipt footer appears here'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
