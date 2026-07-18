'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Branch = {
  id: string;
  name: string;
  city: string;
  address: string;
  operatingHoursStart: string;
  operatingHoursEnd: string;
};

type Company = {
  id: string;
  name: string;
  description: string | null;
  branches: Branch[];
};

export default function CompanyOverviewPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [form, setForm] = useState({
    name: '',
    city: 'Lahore',
    address: '',
    operatingHoursStart: '06:00',
    operatingHoursEnd: '23:00',
  });

  async function load() {
    const { data } = await api<Company>(`/api/companies/${companyId}`);
    setCompany(data);
    setCompanyName(data.name);
    setCompanyDescription(data.description ?? '');
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function onRenameCompany(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/api/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: companyName.trim(),
          description: companyDescription.trim() || null,
        }),
      });
      setShowRename(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename company');
    } finally {
      setSaving(false);
    }
  }

  async function onCreateBranch(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/api/companies/${companyId}/branches`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({
        name: '',
        city: 'Lahore',
        address: '',
        operatingHoursStart: '06:00',
        operatingHoursEnd: '23:00',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setSaving(false);
    }
  }

  if (!company) {
    return <p className="text-sm text-muted-foreground">{error ?? 'Loading company…'}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">{company.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {company.description ?? 'Manage branches for this company.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowRename((v) => !v);
              setShowForm(false);
              setCompanyName(company.name);
              setCompanyDescription(company.description ?? '');
            }}
          >
            {showRename ? 'Cancel' : 'Rename company'}
          </Button>
          <Button
            onClick={() => {
              setShowForm((v) => !v);
              setShowRename(false);
            }}
          >
            {showForm ? 'Cancel' : 'Add branch'}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {showRename ? (
        <Card>
          <CardHeader>
            <CardTitle>Rename company</CardTitle>
            <CardDescription>Updates the company name shown to staff and customers.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={onRenameCompany}>
              <div className="space-y-2">
                <Label>Company name</Label>
                <Input
                  required
                  minLength={2}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving || companyName.trim().length < 2}>
                  {saving ? 'Saving…' : 'Save name'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>New branch</CardTitle>
            <CardDescription>Create a venue location under this company.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={onCreateBranch}>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  required
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input
                  required
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Opens (HH:mm)</Label>
                <Input
                  required
                  placeholder="06:00"
                  pattern="^\\d{2}:\\d{2}$"
                  value={form.operatingHoursStart}
                  onChange={(e) => setForm((f) => ({ ...f, operatingHoursStart: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Closes (HH:mm)</Label>
                <Input
                  required
                  placeholder="23:00"
                  pattern="^\\d{2}:\\d{2}$"
                  value={form.operatingHoursEnd}
                  onChange={(e) => setForm((f) => ({ ...f, operatingHoursEnd: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Same-day: 06:00–23:00. Overnight OK: 18:00–02:00 or 06:00–04:00.
                </p>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating…' : 'Create branch'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {company.branches.map((branch) => (
          <Card key={branch.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{branch.name}</CardTitle>
                <Badge>{branch.city}</Badge>
              </div>
              <CardDescription>{branch.address}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Hours {branch.operatingHoursStart}–{branch.operatingHoursEnd}
              </span>
              <Link
                href={`/branches/${branch.id}`}
                className="inline-flex h-9 items-center rounded-md bg-navy px-3 text-sm font-medium text-white hover:bg-navy-700"
              >
                Manage
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
