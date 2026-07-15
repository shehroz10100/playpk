'use client';

import { useEffect, useState } from 'react';
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

export default function BookingsPage() {
  const params = useParams<{ branchId: string }>();
  const branchId = params.branchId;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const query = new URLSearchParams();
    if (date) query.set('date', date);
    if (status) query.set('status', status);
    query.set('pageSize', '50');
    const { data, meta: responseMeta } = await api<Booking[]>(
      `/api/branches/${branchId}/bookings?${query.toString()}`,
    );
    setBookings(data);
    setMeta(responseMeta);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [branchId, date, status]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All bookings for this branch, filterable by date and status.
        </p>
      </div>

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
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
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
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No bookings match these filters.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-border">
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
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {booking.paymentStatus}
                    </td>
                    <td className="px-4 py-3">
                      {booking.status === 'CONFIRMED' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === booking.id}
                          onClick={() => completeBooking(booking.id)}
                        >
                          {busyId === booking.id ? '…' : 'Mark complete'}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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
