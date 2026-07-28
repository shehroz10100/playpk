'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SportFilterRail } from '@/components/sport-filter-rail';

type Sport = { id: string; name: string; iconUrl?: string | null };
type Court = {
  id: string;
  name: string;
  capacity: number;
  pricePerHour: number;
  indoor: boolean;
  hasAC: boolean;
  equipmentAvailable: string[];
  photos: string[];
  sport: Sport;
  sportId: string;
};

export default function CourtsPage() {
  const params = useParams<{ branchId: string }>();
  const branchId = params.branchId;
  const [courts, setCourts] = useState<Court[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sportId: '',
    name: '',
    capacity: 4,
    pricePerHour: 2500,
    indoor: true,
    hasAC: false,
    equipmentAvailable: '',
  });
  const [photos, setPhotos] = useState<FileList | null>(null);

  async function load() {
    const [courtsRes, sportsRes] = await Promise.all([
      api<Court[]>(`/api/branches/${branchId}/courts`),
      api<Sport[]>('/api/sports'),
    ]);
    setCourts(courtsRes.data);
    setSports(sportsRes.data);
    if (!form.sportId && sportsRes.data[0]) {
      setForm((f) => ({ ...f, sportId: sportsRes.data[0].id }));
    }
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  function startCreate() {
    setEditingId('new');
    setForm({
      sportId: sports[0]?.id ?? '',
      name: '',
      capacity: 4,
      pricePerHour: 2500,
      indoor: true,
      hasAC: false,
      equipmentAvailable: '',
    });
    setPhotos(null);
  }

  function startEdit(court: Court) {
    setEditingId(court.id);
    setForm({
      sportId: court.sportId,
      name: court.name,
      capacity: court.capacity,
      pricePerHour: court.pricePerHour,
      indoor: court.indoor,
      hasAC: court.hasAC,
      equipmentAvailable: court.equipmentAvailable.join(', '),
    });
    setPhotos(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        sportId: form.sportId,
        name: form.name,
        capacity: Number(form.capacity),
        pricePerHour: Number(form.pricePerHour),
        indoor: form.indoor,
        hasAC: form.hasAC,
        equipmentAvailable: form.equipmentAvailable
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };

      let courtId = editingId;
      if (editingId === 'new') {
        const { data } = await api<Court>(`/api/branches/${branchId}/courts`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        courtId = data.id;
      } else if (editingId) {
        await api(`/api/branches/${branchId}/courts/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }

      if (photos && photos.length > 0 && courtId && courtId !== 'new') {
        const body = new FormData();
        Array.from(photos).forEach((file) => body.append('photos', file));
        await api(`/api/branches/${branchId}/courts/${courtId}/photos`, {
          method: 'POST',
          body,
        });
      }

      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const offeredSports = [...new Set(courts.map((c) => c.sport.name))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Courts & sports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage courts offered at this branch, pricing, amenities, and photos.
          </p>
        </div>
        <Button onClick={startCreate}>Add court</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sports offered</CardTitle>
          <CardDescription>Derived from active courts at this branch.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {offeredSports.length === 0 ? (
            <span className="text-sm text-muted-foreground">No sports configured yet.</span>
          ) : (
            offeredSports.map((sport) => (
              <Badge key={sport} variant="success">
                {sport}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {editingId ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId === 'new' ? 'Add court' : 'Edit court'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Sport</Label>
                <SportFilterRail
                  sports={sports}
                  value={form.sportId}
                  onChange={(id) => setForm((f) => ({ ...f, sportId: id }))}
                  valueMode="id"
                  featuredOnly={false}
                  showAll={false}
                  size="sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  required
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Price / hour (PKR)</Label>
                <Input
                  type="number"
                  min={1}
                  required
                  value={form.pricePerHour}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, pricePerHour: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Equipment (comma-separated)</Label>
                <Input
                  value={form.equipmentAvailable}
                  onChange={(e) => setForm((f) => ({ ...f, equipmentAvailable: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.indoor}
                  onChange={(e) => setForm((f) => ({ ...f, indoor: e.target.checked }))}
                />
                Indoor
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.hasAC}
                  onChange={(e) => setForm((f) => ({ ...f, hasAC: e.target.checked }))}
                />
                Has AC
              </label>
              <div className="space-y-2 md:col-span-2">
                <Label>Photos</Label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setPhotos(e.target.files)}
                />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save court'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {courts.map((court) => (
          <Card key={court.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{court.name}</CardTitle>
                <CardDescription>
                  {court.sport.name} · Capacity {court.capacity} · {formatPkr(court.pricePerHour)}
                  /hr
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => startEdit(court)}>
                Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={court.indoor ? 'success' : 'muted'}>
                  {court.indoor ? 'Indoor' : 'Outdoor'}
                </Badge>
                <Badge variant={court.hasAC ? 'success' : 'muted'}>
                  {court.hasAC ? 'AC' : 'No AC'}
                </Badge>
                {court.equipmentAvailable.map((item) => (
                  <Badge key={item} variant="muted">
                    {item}
                  </Badge>
                ))}
              </div>
              {court.photos.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {court.photos.map((url) => (
                    <Image
                      key={url}
                      src={url}
                      alt={court.name}
                      width={112}
                      height={80}
                      unoptimized
                      className="h-20 w-28 rounded-md object-cover"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No photos uploaded.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
