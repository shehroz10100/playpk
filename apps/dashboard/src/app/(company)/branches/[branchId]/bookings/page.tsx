'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { useVisibilityPoll } from '@/hooks/use-visibility-poll';
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
  paymentProofUploadedAt?: string | null;
  cancelledAt?: string | null;
  totalAmount: number;
  createdAt: string;
  user: { name: string; email: string | null; phone: string | null };
  slot: {
    date: string;
    startTime: string;
    endTime: string;
    status?: string;
    court: { name: string; sport: { name: string } };
  };
};

const statusVariant: Record<string, 'success' | 'warn' | 'danger' | 'muted'> = {
  CONFIRMED: 'success',
  PENDING: 'warn',
  CANCELLED: 'danger',
  COMPLETED: 'muted',
};

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

  const pendingProofs = useMemo(
    () =>
      bookings.filter(
        (b) =>
          Boolean(b.paymentProofUrl) &&
          (b.paymentStatus === 'PENDING' || b.status === 'PENDING'),
      ),
    [bookings],
  );

  const allProofs = useMemo(
    () => bookings.filter((b) => Boolean(b.paymentProofUrl)),
    [bookings],
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

  async function cancelBooking(id: string, customerName: string) {
    const ok = window.confirm(
      `Cancel booking for ${customerName}? The court slot will open again for other players.`,
    );
    if (!ok) return;
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/bookings/${id}/cancel`, { method: 'POST' });
      setLiveBanner(`Booking cancelled · slot reopened · ID ${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live list for this branch — advance payment screenshots appear below when customers upload
          them at checkout.
        </p>
      </div>

      {liveBanner ? (
        <p className="rounded-md border border-brand/30 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {liveBanner}
        </p>
      ) : null}

      {pendingProofs.length > 0 ? (
        <Card className="border-accent/40">
          <CardHeader>
            <CardTitle>Advance payment screenshots to verify</CardTitle>
            <CardDescription>
              {pendingProofs.length} pending — open the photo, confirm the transfer, then verify.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pendingProofs.map((booking) => (
              <div
                key={booking.id}
                className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
              >
                <a
                  href={booking.paymentProofUrl!}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-muted"
                >
                  <Image
                    src={booking.paymentProofUrl!}
                    alt={`Payment proof from ${booking.user.name}`}
                    width={400}
                    height={176}
                    unoptimized
                    className="h-44 w-full object-contain bg-[#F4F6F8]"
                  />
                </a>
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-navy">{booking.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.slot.court.name} · {String(booking.slot.date).slice(0, 10)} ·{' '}
                        {booking.slot.startTime}–{booking.slot.endTime}
                      </p>
                    </div>
                    <Badge variant="warn">{booking.paymentStatus}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {booking.paymentMethod ?? 'bank'} · {formatPkr(booking.totalAmount)}
                    {booking.paymentProofUploadedAt
                      ? ` · uploaded ${new Date(booking.paymentProofUploadedAt).toLocaleString()}`
                      : ''}
                  </p>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={busyId === booking.id}
                    onClick={() => void verifyPayment(booking.id)}
                  >
                    {busyId === booking.id ? '…' : 'Verify payment'}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : allProofs.length > 0 ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {allProofs.length} payment screenshot{allProofs.length === 1 ? '' : 's'} on file — none
          waiting for verification right now. See thumbnails in the table below.
        </p>
      ) : (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          No advance payment screenshots yet. When a customer pays by bank transfer and uploads a
          photo, it shows here and in the Payment column below.
        </p>
      )}

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
                <th className="px-4 py-3 font-medium">Payment proof</th>
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
                      {booking.status === 'CANCELLED' ? (
                        <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                          {booking.cancelledAt ? (
                            <div>Cancelled {new Date(booking.cancelledAt).toLocaleString()}</div>
                          ) : null}
                          <div className="font-medium text-brand">Slot reopened</div>
                        </div>
                      ) : booking.slot.status ? (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          Slot · {booking.slot.status}
                        </div>
                      ) : null}
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
                          title="Open payment screenshot"
                        >
                          <Image
                            src={booking.paymentProofUrl}
                            alt="Payment proof"
                            width={112}
                            height={80}
                            unoptimized
                            className="h-20 w-28 rounded-md border border-border object-cover"
                          />
                          <span className="mt-1 block text-[10px] font-semibold text-brand">
                            View screenshot
                          </span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">No screenshot</span>
                      )}
                    </td>
                    <td className="space-y-1 px-4 py-3">
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
                      ) : null}
                      {booking.status === 'PENDING' || booking.status === 'CONFIRMED' ? (
                        <Button
                          size="sm"
                          variant="danger"
                          className="w-full"
                          disabled={busyId === booking.id}
                          onClick={() => void cancelBooking(booking.id, booking.user.name)}
                        >
                          {busyId === booking.id ? '…' : 'Cancel booking'}
                        </Button>
                      ) : null}
                      {booking.status === 'CANCELLED' ? (
                        <span className="text-xs font-medium text-muted-foreground">Cancelled</span>
                      ) : null}
                      {booking.status !== 'PENDING' &&
                      booking.status !== 'CONFIRMED' &&
                      booking.status !== 'CANCELLED' &&
                      !booking.paymentProofUrl ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : null}
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
