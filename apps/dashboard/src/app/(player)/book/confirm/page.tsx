'use client';

import { Suspense } from 'react';
import BookConfirmPage from './confirm-client';

export default function BookConfirmRoute() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading checkout…</p>}>
      <BookConfirmPage />
    </Suspense>
  );
}
