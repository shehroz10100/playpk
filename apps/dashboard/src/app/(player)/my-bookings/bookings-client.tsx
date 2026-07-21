'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Calendar, MapPin } from 'lucide-react';
import type { BookingDto, MyBookingsResponse } from '@playpk/shared-types';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { MotionPress, MotionReveal } from '@/components/motion/motion-reveal';
import { StadiumSkeleton } from '@/components/motion/stadium-skeleton';
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
      .then(({ data }) =>
        setBookings(
          Array.isArray(data.all) ? data.all : [...(data.upcoming ?? []), ...(data.past ?? [])],
        ),
      )
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Account</p>
        <h1 className="font-display mt-1 text-3xl font-bold uppercase tracking-tight text-navy">
          My bookings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your upcoming and past court reservations.
        </p>
      </div>

      {justBooked ? (
        <p className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm font-medium text-brand-700">
          Booking confirmed · ticket {justBooked}
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <StadiumSkeleton lines={3} /> : null}

      <div className="grid gap-3">
        {bookings.map((b, index) => (
          <MotionReveal key={b.id} index={index}>
            <Card className="rounded-2xl border-0 shadow-panel">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="font-display text-base font-bold uppercase tracking-tight text-navy">
                      {b.slot?.court?.branch?.name ?? 'Venue'}
                    </CardTitle>
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
              <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-navy">
                  <Calendar className="h-3.5 w-3.5 text-brand" />
                  {String(b.slot?.date ?? '').slice(0, 10)} · {b.slot?.startTime}–{b.slot?.endTime}
                </span>
                <span className="font-display text-base font-bold tabular-nums text-navy">
                  {formatPkr(Number(b.totalAmount))}
                </span>
              </CardContent>
            </Card>
          </MotionReveal>
        ))}
      </div>

      {!loading && bookings.length === 0 ? (
        <MotionPress>
          <Link
            href="/discover"
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-panel"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <MapPin className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-semibold text-navy">No bookings yet</span>
              <span className="text-sm text-muted-foreground">Discover a venue to book a court</span>
            </span>
          </Link>
        </MotionPress>
      ) : null}
    </div>
  );
}
