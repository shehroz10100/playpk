'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type CompanyRow = {
  id: string;
  name: string;
  approvalStatus: string;
  commissionPercent: number;
  rejectionReason: string | null;
  owner?: { name: string; email: string | null };
  branches?: Array<{ id: string; name: string; city: string; approvalStatus: string }>;
};

export default function AdminCompaniesPage() {
  const [items, setItems] = useState<CompanyRow[]>([]);
  const [filter, setFilter] = useState('');
  const [commissionEdits, setCommissionEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const params = filter ? `?approvalStatus=${filter}` : '';
    const { data } = await api<CompanyRow[]>(`/api/admin/companies${params}`);
    setItems(data);
    const edits: Record<string, string> = {};
    for (const c of data) edits[c.id] = String(c.commissionPercent);
    setCommissionEdits(edits);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [filter]);

  async function approve(id: string) {
    setBusyId(id);
    try {
      await api(`/api/admin/companies/${id}/approve`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    try {
      await api(`/api/admin/companies/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Does not meet PlayPK venue standards' }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  }

  async function saveCommission(id: string) {
    setBusyId(id);
    try {
      await api(`/api/admin/companies/${id}/commission`, {
        method: 'PATCH',
        body: JSON.stringify({ commissionPercent: Number(commissionEdits[id]) }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commission update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function approveBranch(branchId: string) {
    setBusyId(branchId);
    try {
      await api(`/api/admin/branches/${branchId}/approve`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Branch approve failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Companies & approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          New companies start PENDING until you approve. Set commission % per company.
        </p>
      </div>

      <div className="flex gap-2">
        {['', 'PENDING', 'APPROVED', 'REJECTED'].map((v) => (
          <Button
            key={v || 'all'}
            size="sm"
            variant={filter === v ? 'default' : 'outline'}
            onClick={() => setFilter(v)}
          >
            {v || 'All'}
          </Button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-4">
        {items.map((c) => (
          <Card key={c.id}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle>{c.name}</CardTitle>
                <CardDescription>
                  Owner {c.owner?.name} · {c.owner?.email}
                </CardDescription>
              </div>
              <Badge
                variant={
                  c.approvalStatus === 'APPROVED'
                    ? 'success'
                    : c.approvalStatus === 'PENDING'
                      ? 'warn'
                      : 'danger'
                }
              >
                {c.approvalStatus}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {c.rejectionReason ? (
                <p className="text-sm text-red-600">Rejected: {c.rejectionReason}</p>
              ) : null}
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Commission %</div>
                  <Input
                    className="w-28"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={commissionEdits[c.id] ?? ''}
                    onChange={(e) =>
                      setCommissionEdits((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === c.id}
                  onClick={() => saveCommission(c.id)}
                >
                  Save commission
                </Button>
                {c.approvalStatus !== 'APPROVED' ? (
                  <Button size="sm" disabled={busyId === c.id} onClick={() => approve(c.id)}>
                    Approve
                  </Button>
                ) : null}
                {c.approvalStatus === 'PENDING' ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busyId === c.id}
                    onClick={() => reject(c.id)}
                  >
                    Reject
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Branches</div>
                {(c.branches ?? []).map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>
                      {b.name} · {b.city}{' '}
                      <Badge variant="muted">{b.approvalStatus}</Badge>
                    </span>
                    {b.approvalStatus !== 'APPROVED' && c.approvalStatus === 'APPROVED' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === b.id}
                        onClick={() => approveBranch(b.id)}
                      >
                        Approve branch
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
