'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PAKISTAN_CITIES = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Gujranwala',
  'Other',
] as const;

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
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  branches: Branch[];
};

export default function CompanyOverviewPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [showBank, setShowBank] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState({
    name: '',
    city: 'Lahore',
    address: '',
    operatingHoursStart: '06:00',
    operatingHoursEnd: '23:00',
  });
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
    setBankAccountName(data.bankAccountName ?? '');
    setBankAccountNumber(data.bankAccountNumber ?? '');
    setBankName(data.bankName ?? '');
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  function citySelectValue(city: string) {
    return (PAKISTAN_CITIES as readonly string[]).includes(city) ? city : 'Other';
  }

  async function onSaveBank(e: FormEvent) {
    e.preventDefault();
    const name = bankAccountName.trim();
    const number = bankAccountNumber.trim();
    const bank = bankName.trim();
    if (name.length < 2 || number.length < 5 || bank.length < 2) {
      setError('Enter account name, account number (min 5 chars), and bank name before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    setBankSaved(false);
    try {
      const { data } = await api<Company>(`/api/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          bankAccountName: name,
          bankAccountNumber: number,
          bankName: bank,
        }),
      });
      setCompany((prev) =>
        prev
          ? {
              ...prev,
              bankAccountName: data.bankAccountName,
              bankAccountNumber: data.bankAccountNumber,
              bankName: data.bankName,
            }
          : prev,
      );
      setBankAccountName(data.bankAccountName ?? name);
      setBankAccountNumber(data.bankAccountNumber ?? number);
      setBankName(data.bankName ?? bank);
      setBankSaved(true);
      setShowBank(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bank details');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveCompanyInfo(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfoSaved(false);
    try {
      const { data } = await api<Company>(`/api/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          description: companyDescription.trim() || null,
        }),
      });
      setCompany((prev) =>
        prev
          ? { ...prev, description: data.description ?? (companyDescription.trim() || null) }
          : prev,
      );
      setCompanyDescription(data.description ?? '');
      setShowCompanyInfo(false);
      setInfoSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save company information');
    } finally {
      setSaving(false);
    }
  }

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

  function startEditLocation(branch: Branch) {
    setEditingBranchId(branch.id);
    setShowForm(false);
    setShowRename(false);
    setShowBank(false);
    setLocationForm({
      name: branch.name,
      city: branch.city,
      address: branch.address,
      operatingHoursStart: branch.operatingHoursStart,
      operatingHoursEnd: branch.operatingHoursEnd,
    });
    setError(null);
  }

  async function onSaveLocation(e: FormEvent) {
    e.preventDefault();
    if (!editingBranchId) return;
    const city = locationForm.city.trim();
    const address = locationForm.address.trim();
    if (city.length < 2 || address.length < 5) {
      setError('Enter a city and a full location / address (at least 5 characters).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(`/api/branches/${editingBranchId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: locationForm.name.trim(),
          city,
          address,
          operatingHoursStart: locationForm.operatingHoursStart,
          operatingHoursEnd: locationForm.operatingHoursEnd,
        }),
      });
      setEditingBranchId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update location');
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
            {company.description ?? 'Manage branches, city, and location for this company.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/companies/${companyId}/branding`}
            className="inline-flex h-9 items-center rounded-md border border-border bg-white px-3 text-sm text-navy hover:bg-muted"
          >
            Branding
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              setShowCompanyInfo((v) => !v);
              setShowBank(false);
              setShowRename(false);
              setShowForm(false);
              setEditingBranchId(null);
              setCompanyDescription(company.description ?? '');
              setInfoSaved(false);
            }}
          >
            {showCompanyInfo ? 'Cancel' : 'Company information'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowBank((v) => !v);
              setShowRename(false);
              setShowForm(false);
              setShowCompanyInfo(false);
              setEditingBranchId(null);
              setBankAccountName(company.bankAccountName ?? '');
              setBankAccountNumber(company.bankAccountNumber ?? '');
              setBankName(company.bankName ?? '');
            }}
          >
            {showBank ? 'Cancel' : 'Bank account'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowRename((v) => !v);
              setShowForm(false);
              setShowBank(false);
              setShowCompanyInfo(false);
              setEditingBranchId(null);
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
              setShowBank(false);
              setShowCompanyInfo(false);
              setEditingBranchId(null);
            }}
          >
            {showForm ? 'Cancel' : 'Add branch'}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {infoSaved ? (
        <p className="rounded-md border border-brand/30 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Company information saved. Customers will see it on the venue Home tab.
        </p>
      ) : null}
      {bankSaved ? (
        <p className="rounded-md border border-brand/30 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Bank details saved. Customers will see account name, number, and bank on checkout.
        </p>
      ) : null}

      {showCompanyInfo ? (
        <Card>
          <CardHeader>
            <CardTitle>Company information</CardTitle>
            <CardDescription>
              Shown to customers under Club information on your venue page (Home tab).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSaveCompanyInfo}>
              <div className="space-y-2">
                <Label htmlFor="company-info">About your club</Label>
                <textarea
                  id="company-info"
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  placeholder="Tell players about your facilities, sports, parking, coaching, and house rules…"
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-navy outline-none ring-brand/30 focus:ring-2"
                />
                <p className="text-xs text-muted-foreground">
                  {companyDescription.length}/2000 characters
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'OK · Save'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setShowCompanyInfo(false);
                    setCompanyDescription(company.description ?? '');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company information</CardTitle>
            <CardDescription>
              {company.description?.trim()
                ? company.description
                : 'Not set yet — add a short description so customers know about your club.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCompanyInfo(true);
                setShowBank(false);
                setShowRename(false);
                setShowForm(false);
                setEditingBranchId(null);
                setCompanyDescription(company.description ?? '');
                setInfoSaved(false);
              }}
            >
              {company.description?.trim() ? 'Edit information' : 'Add information'}
            </Button>
          </CardContent>
        </Card>
      )}

      {showBank ? (
        <Card>
          <CardHeader>
            <CardTitle>Bank account for advances</CardTitle>
            <CardDescription>
              Customers see these details when paying booking advance by bank transfer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={onSaveBank}>
              <div className="space-y-2">
                <Label>Account name</Label>
                <Input
                  required
                  minLength={2}
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="GameOn Sports Pvt Ltd"
                />
              </div>
              <div className="space-y-2">
                <Label>Account no.</Label>
                <Input
                  required
                  minLength={5}
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="0123456789"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Bank name</Label>
                <Input
                  required
                  minLength={2}
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="HBL / Meezan / MCB"
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save bank details'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Advance bank details</CardTitle>
            <CardDescription>
              {company.bankAccountNumber
                ? `${company.bankName ?? 'Bank'} · ${company.bankAccountName ?? '—'} · ${company.bankAccountNumber}`
                : 'Not set — add account name, number, and bank so customers can transfer advances.'}
            </CardDescription>
          </CardHeader>
          {company.bankAccountNumber ? (
            <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Account name</p>
                <p className="font-semibold text-navy">{company.bankAccountName ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account no.</p>
                <p className="font-semibold tabular-nums text-navy">
                  {company.bankAccountNumber}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bank name</p>
                <p className="font-semibold text-navy">{company.bankName ?? '—'}</p>
              </div>
            </CardContent>
          ) : null}
        </Card>
      )}

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
            <CardDescription>
              Create a venue with city and street location (shown to customers on Discover).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={onCreateBranch}>
              <div className="space-y-2">
                <Label htmlFor="new-branch-name">Branch name</Label>
                <Input
                  id="new-branch-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="DHA Phase 5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-branch-city">City</Label>
                <select
                  id="new-branch-city"
                  required
                  className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={citySelectValue(form.city)}
                  onChange={(e) => {
                    const next = e.target.value;
                    setForm((f) => ({
                      ...f,
                      city: next === 'Other' ? '' : next,
                    }));
                  }}
                >
                  {PAKISTAN_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {citySelectValue(form.city) === 'Other' ? (
                  <Input
                    required
                    minLength={2}
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Enter city name"
                    className="mt-2"
                  />
                ) : null}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="new-branch-address">Location / address</Label>
                <Input
                  id="new-branch-address"
                  required
                  minLength={5}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="23-K, DHA Phase 5, Lahore"
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

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-navy">Venue locations</h2>
          <p className="text-sm text-muted-foreground">
            City and street address for each branch — used on the customer Discover page.
          </p>
        </div>

        {company.branches.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 py-8">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <MapPin className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-navy">No venues yet</p>
                <p className="text-sm text-muted-foreground">
                  Add a branch with city and location so customers can find you.
                </p>
              </div>
              <Button type="button" onClick={() => setShowForm(true)}>
                Add branch
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
            {company.branches.map((branch) => (
              <Card key={branch.id} className="flex h-full flex-col">
                {editingBranchId === branch.id ? (
                  <>
                    <CardHeader>
                      <CardTitle className="text-base">Edit city &amp; location</CardTitle>
                      <CardDescription>
                        Update how this venue appears to customers searching by city.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form className="grid gap-3" onSubmit={onSaveLocation}>
                        <div className="space-y-1.5">
                          <Label htmlFor={`edit-name-${branch.id}`}>Branch name</Label>
                          <Input
                            id={`edit-name-${branch.id}`}
                            required
                            minLength={2}
                            value={locationForm.name}
                            onChange={(e) =>
                              setLocationForm((f) => ({ ...f, name: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`edit-city-${branch.id}`}>City</Label>
                          <select
                            id={`edit-city-${branch.id}`}
                            required
                            className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                            value={citySelectValue(locationForm.city)}
                            onChange={(e) => {
                              const next = e.target.value;
                              setLocationForm((f) => ({
                                ...f,
                                city: next === 'Other' ? '' : next,
                              }));
                            }}
                          >
                            {PAKISTAN_CITIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          {citySelectValue(locationForm.city) === 'Other' ? (
                            <Input
                              required
                              minLength={2}
                              value={locationForm.city}
                              onChange={(e) =>
                                setLocationForm((f) => ({ ...f, city: e.target.value }))
                              }
                              placeholder="Enter city name"
                            />
                          ) : null}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`edit-address-${branch.id}`}>Location / address</Label>
                          <Input
                            id={`edit-address-${branch.id}`}
                            required
                            minLength={5}
                            value={locationForm.address}
                            onChange={(e) =>
                              setLocationForm((f) => ({ ...f, address: e.target.value }))
                            }
                            placeholder="Street, area, landmark"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>Opens</Label>
                            <Input
                              required
                              pattern="^\\d{2}:\\d{2}$"
                              value={locationForm.operatingHoursStart}
                              onChange={(e) =>
                                setLocationForm((f) => ({
                                  ...f,
                                  operatingHoursStart: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Closes</Label>
                            <Input
                              required
                              pattern="^\\d{2}:\\d{2}$"
                              value={locationForm.operatingHoursEnd}
                              onChange={(e) =>
                                setLocationForm((f) => ({
                                  ...f,
                                  operatingHoursEnd: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button type="submit" disabled={saving}>
                            {saving ? 'Saving…' : 'Save location'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={saving}
                            onClick={() => setEditingBranchId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </>
                ) : (
                  <>
                    <CardHeader className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-2">{branch.name}</CardTitle>
                        <Badge className="shrink-0">{branch.city}</Badge>
                      </div>
                      <CardDescription className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                        <span className="line-clamp-3">{branch.address}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        Hours {branch.operatingHoursStart}–{branch.operatingHoursEnd}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEditLocation(branch)}
                        >
                          Edit location
                        </Button>
                        <Link
                          href={`/branches/${branch.id}`}
                          className="inline-flex h-9 shrink-0 items-center rounded-md bg-navy px-3 text-sm font-medium text-white hover:bg-navy-700"
                        >
                          Manage
                        </Link>
                      </div>
                    </CardContent>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
