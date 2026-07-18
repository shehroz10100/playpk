'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Ticket = {
  id: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  adminNotes: string | null;
  createdAt: string;
  user: { name: string; email: string | null; phone: string | null };
  company?: { name: string } | null;
  branch?: { name: string } | null;
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const params = status ? `?status=${status}` : '';
    const { data } = await api<Ticket[]>(`/api/admin/tickets${params}`);
    setTickets(data);
    const n: Record<string, string> = {};
    for (const t of data) n[t.id] = t.adminNotes ?? '';
    setNotes(n);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function update(ticketId: string, patch: Record<string, unknown>) {
    setBusyId(ticketId);
    try {
      await api(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Support inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complaints and tickets from players / owners (`POST /api/support/tickets`).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((v) => (
          <Button
            key={v || 'all'}
            size="sm"
            variant={status === v ? 'default' : 'outline'}
            onClick={() => setStatus(v)}
          >
            {v || 'All'}
          </Button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-4">
        {tickets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No tickets in this filter.
            </CardContent>
          </Card>
        ) : (
          tickets.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-lg">{t.subject}</CardTitle>
                  <CardDescription>
                    {t.user.name} · {t.user.email ?? t.user.phone} ·{' '}
                    {new Date(t.createdAt).toLocaleString()}
                    {t.company ? ` · ${t.company.name}` : ''}
                    {t.branch ? ` / ${t.branch.name}` : ''}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="muted">{t.priority}</Badge>
                  <Badge
                    variant={
                      t.status === 'OPEN'
                        ? 'warn'
                        : t.status === 'RESOLVED' || t.status === 'CLOSED'
                          ? 'success'
                          : 'muted'
                    }
                  >
                    {t.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-navy whitespace-pre-wrap">{t.body}</p>
                <Input
                  placeholder="Admin notes"
                  value={notes[t.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [t.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === t.id}
                    onClick={() =>
                      update(t.id, {
                        adminNotes: notes[t.id] || null,
                        status: 'IN_PROGRESS',
                      })
                    }
                  >
                    Mark in progress
                  </Button>
                  <Button
                    size="sm"
                    disabled={busyId === t.id}
                    onClick={() =>
                      update(t.id, {
                        adminNotes: notes[t.id] || null,
                        status: 'RESOLVED',
                      })
                    }
                  >
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyId === t.id}
                    onClick={() =>
                      update(t.id, {
                        adminNotes: notes[t.id] || null,
                        status: 'CLOSED',
                      })
                    }
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
