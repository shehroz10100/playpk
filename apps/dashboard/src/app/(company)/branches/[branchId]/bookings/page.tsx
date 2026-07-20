'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Booking = {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  paymentProofUrl?: string | null;
  totalAmount: number;
  createdAt: string;
  user: { name: string; email: string | null; phone: string | null };
  slot: {
    date: string;
    startTime: string;
    endTime: string;
    court: { name: string; sport: { name: string } };
  };
};

const statusVariant: Record<string, 'success' | 'warn' | 'danger' | 'muted'> = {
  CONFIRMED: 'success',
  PENDING: 'warn',
  CANCELLED: 'danger',
  COMPLETED: 'muted',
};

import { useVisibilityPoll } from '@/hooks/use-visibility-poll';

export default function BookingsPage() {
  const params = useParams<{ branchId: string }>();
  const branchId = params.branchId;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [liveBanner, setLiveBanner] = useState<string | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (date) query.set('date', date);
    if (status) query.set('status', status);
    query.set('pageSize', '50');
    const { data, meta: responseMeta } = await api<Booking[]>(
      `/api/branches/${branchId}/bookings?${query.toString()}`,
    );

    if (!primed.current) {
      knownIds.current = new Set(data.map((b) => b.id));
      primed.current = true;
    } else {
      const fresh = data.filter((b) => !knownIds.current.has(b.id));
      if (fresh.length > 0) {
        const latest = fresh[0];
        setLiveBanner(
          `New booking · ${latest.user.name} · ${latest.slot.court.name} · ID ${latest.id}`,
        );
        for (const b of fresh) knownIds.current.add(b.id);
      }
    }

    setBookings(data);
    setMeta(responseMeta);
  }, [branchId, date, status]);

  useEffect(() => {
    primed.current = false;
    knownIds.current = new Set();
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  useVisibilityPoll(
    () => {
      load().catch(() => undefined);
    },
    true,
    { intervalMs: 20000 },
  );

  async function completeBooking(bookingId: string) {
    setBusyId(bookingId);
    try {
      await api(`/api/bookings/${bookingId}/complete`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete booking');
    } finally {
      setBusyId(null);
    }
  }

  async function verifyPayment(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/bookings/${id}/verify-payment`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verify failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live list for this branch — refreshes automatically when customers book.
        </p>
      </div>

      {liveBanner ? (
        <p className="rounded-md border border-brand/30 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {liveBanner}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Showing {bookings.length}
            {meta?.total != null ? ` of ${String(meta.total)}` : ''} bookings
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={() => void load()}>
              Refresh now
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Booking ID</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Court</th>
                <th className="px-4 py-3 font-medium">Slot</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No bookings match these filters.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <code className="break-all text-[11px] text-navy">{booking.id}</code>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(booking.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-navy">{booking.user.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {booking.user.email ?? booking.user.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{booking.slot.court.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {booking.slot.court.sport.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{String(booking.slot.date).slice(0, 10)}</div>
                      <div className="text-xs text-muted-foreground">
                        {booking.slot.startTime}–{booking.slot.endTime}
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatPkr(booking.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[booking.status] ?? 'muted'}>
                        {booking.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground">
                        {booking.paymentStatus}
                        {booking.paymentMethod ? ` · ${booking.paymentMethod}` : ''}
                      </div>
                      {booking.paymentProofUrl ? (
                        <a
                          href={booking.paymentProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={booking.paymentProofUrl}
                            alt="Payment proof"
                            className="h-14 w-20 rounded object-cover border border-border"
                          />
                        </a>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">No screenshot</span>
                      )}
                    </td>
                    <td className="px-4 py-3 space-y-1">
                      {booking.paymentStatus === 'PENDING' && booking.paymentProofUrl ? (
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={busyId === booking.id}
                          onClick={() => void verifyPayment(booking.id)}
                        >
                          {busyId === booking.id ? '…' : 'Verify payment'}
                        </Button>
                      ) : null}
                      {booking.status === 'CONFIRMED' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          disabled={busyId === booking.id}
                          onClick={() => completeBooking(booking.id)}
                        >
                          {busyId === booking.id ? '…' : 'Mark complete'}
                        </Button>
                      ) : (
                        !booking.paymentProofUrl && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
