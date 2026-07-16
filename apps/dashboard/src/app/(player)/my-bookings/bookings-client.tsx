'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { BookingDto, MyBookingsResponse } from '@playpk/shared-types';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MyBookingsClient() {
  const search = useSearchParams();
  const justBooked = search.get('booked');
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<MyBookingsResponse>('/api/bookings/me')
      .then(({ data }) => setBookings(Array.isArray(data.all) ? data.all : [...(data.upcoming ?? []), ...(data.past ?? [])]))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">My bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your upcoming and past court reservations.
        </p>
      </div>

      {justBooked ? (
        <p className="rounded-md border border-brand/30 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Booking confirmed · ticket {justBooked}
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading bookings…</p> : null}

      <div className="grid gap-4">
        {bookings.map((b) => (
          <Card key={b.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{b.slot?.court?.branch?.name ?? 'Venue'}</CardTitle>
                  <CardDescription>
                    {b.slot?.court?.name} · {b.slot?.court?.sport?.name}
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    b.status === 'CONFIRMED' || b.status === 'PAID' || b.status === 'COMPLETED'
                      ? 'success'
                      : b.status === 'CANCELLED'
                        ? 'danger'
                        : 'muted'
                  }
                >
                  {b.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-navy">
                {String(b.slot?.date ?? '').slice(0, 10)} · {b.slot?.startTime}–{b.slot?.endTime}
              </span>
              <span className="font-semibold text-navy">{formatPkr(Number(b.totalAmount))}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings yet. Discover a venue to book.</p>
      ) : null}
    </div>
  );
}
