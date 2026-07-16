'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BOOKING_ADVANCE_PKR, type AuthUser } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type PayMethod = 'mock' | 'wallet' | 'jazzcash' | 'easypaisa' | 'card';

export default function BookConfirmPage() {
  const router = useRouter();
  const search = useSearchParams();
  const slotId = search.get('slotId') ?? '';
  const courtName = search.get('courtName') ?? '';
  const branchName = search.get('branchName') ?? '';
  const date = search.get('date') ?? '';
  const startTime = search.get('startTime') ?? '';
  const endTime = search.get('endTime') ?? '';
  const rate = Number(search.get('rate') ?? search.get('price') ?? 0);
  const advance = BOOKING_ADVANCE_PKR;

  const [method, setMethod] = useState<PayMethod>('mock');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methods = useMemo<PayMethod[]>(
    () => ['mock', 'wallet', 'jazzcash', 'easypaisa', 'card'],
    [],
  );

  useEffect(() => {
    api<AuthUser>('/api/auth/me')
      .then(({ data }) => setWalletBalance(data.walletBalance ?? null))
      .catch(() => setWalletBalance(null));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slotId) {
      setError('Missing slot. Go back and pick a time again.');
      return;
    }
    if (method === 'wallet' && walletBalance != null && walletBalance < advance) {
      setError('Insufficient wallet balance for the advance.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api<{ id: string }>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({ slotId, paymentMethod: method }),
      });
      router.replace(`/my-bookings?booked=${data.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Booking failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-28">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Confirm & pay</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay a flat advance of {formatPkr(advance)} to confirm. Remaining court balance is settled
          at the venue.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{branchName}</CardTitle>
          <CardDescription>{courtName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Slot</span>
            <span className="font-medium text-navy">
              {date} · {startTime}–{endTime}
            </span>
          </div>
          {rate > 0 ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Court rate</span>
              <span className="text-navy">{formatPkr(rate)}/hr</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Advance due now</span>
            <span className="text-lg font-semibold text-navy">{formatPkr(advance)}</span>
          </div>
          {walletBalance != null ? (
            <p className="text-xs text-muted-foreground">Wallet: {formatPkr(walletBalance)}</p>
          ) : null}
        </CardContent>
      </Card>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap gap-2">
          {methods.map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={method === m ? 'default' : 'outline'}
              onClick={() => setMethod(m)}
            >
              {m}
            </Button>
          ))}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button className="w-full" type="submit" disabled={loading || !slotId}>
          {loading ? 'Booking…' : `Pay ${formatPkr(advance)} advance & book`}
        </Button>
      </form>
    </div>
  );
}
