'use client';

import { Suspense } from 'react';
import MyBookingsClient from './bookings-client';

export default function MyBookingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading bookings…</p>}>
      <MyBookingsClient />
    </Suspense>
  );
}
