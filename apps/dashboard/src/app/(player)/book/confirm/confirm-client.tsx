'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BOOKING_ADVANCE_PKR, type AuthUser } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { getApiBase } from '@/lib/api-base';
import { formatPkr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type PayMethod = 'mock' | 'wallet' | 'jazzcash' | 'easypaisa' | 'card' | 'bank_transfer';

type PaymentInfo = {
  advanceAmount: number;
  company: {
    id: string;
    name: string;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
    bankName: string | null;
  };
};

const BANK_METHODS: PayMethod[] = ['bank_transfer', 'jazzcash', 'easypaisa', 'card'];

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

  const [method, setMethod] = useState<PayMethod>('bank_transfer');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methods = useMemo<PayMethod[]>(
    () => ['bank_transfer', 'wallet', 'jazzcash', 'easypaisa', 'card', 'mock'],
    [],
  );

  const needsProof = BANK_METHODS.includes(method);
  const bank = paymentInfo?.company;

  useEffect(() => {
    api<AuthUser>('/api/auth/me')
      .then(({ data }) => setWalletBalance(data.walletBalance ?? null))
      .catch(() => setWalletBalance(null));
  }, []);

  useEffect(() => {
    if (!slotId) return;
    api<PaymentInfo>(`/api/bookings/payment-info?slotId=${encodeURIComponent(slotId)}`)
      .then(({ data }) => setPaymentInfo(data))
      .catch(() => setPaymentInfo(null));
  }, [slotId]);

  useEffect(() => {
    if (!proofFile) {
      setProofPreview(null);
      return;
    }
    const url = URL.createObjectURL(proofFile);
    setProofPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [proofFile]);

  async function uploadProof(): Promise<string> {
    if (!proofFile) throw new Error('Select a payment screenshot');
    const token = getAccessToken();
    const form = new FormData();
    form.append('proof', proofFile);
    const res = await fetch(`${getApiBase()}/api/bookings/payment-proof`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const json = (await res.json()) as {
      success: boolean;
      data?: { url: string };
      error?: { message: string };
    };
    if (!res.ok || !json.success || !json.data?.url) {
      throw new Error(json.error?.message ?? 'Screenshot upload failed');
    }
    return json.data.url;
  }

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
    if (needsProof && !proofFile) {
      setError('Upload a screenshot of your advance payment transfer.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let paymentProofUrl: string | undefined;
      if (needsProof) {
        paymentProofUrl = await uploadProof();
      }
      const { data } = await api<{ id: string }>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          slotId,
          paymentMethod: method,
          paymentProofUrl,
        }),
      });
      router.replace(`/my-bookings?booked=${data.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-28 animate-rise">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Advance</p>
        <h1 className="font-display mt-1 text-3xl font-extrabold text-navy">Confirm &amp; pay</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay a flat advance of {formatPkr(advance)} to confirm. Remaining court balance is settled
          at the venue.
        </p>
      </div>

      <Card className="rounded-2xl border-0 shadow-panel">
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

      {needsProof ? (
        <Card className="rounded-2xl border-0 shadow-panel">
          <CardHeader>
            <CardTitle className="text-base">Company bank account</CardTitle>
            <CardDescription>
              Transfer {formatPkr(advance)} to this account, then upload the screenshot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {bank?.bankAccountName || bank?.bankAccountNumber || bank?.bankName ? (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Account name</span>
                  <span className="font-semibold text-navy">{bank.bankAccountName ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Account no.</span>
                  <span className="font-semibold text-navy">{bank.bankAccountNumber ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Bank name</span>
                  <span className="font-semibold text-navy">{bank.bankName ?? '—'}</span>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  Payable to {bank.name}
                </p>
              </>
            ) : (
              <p className="text-sm text-amber-700">
                This company has not added bank details yet. Ask them to update company settings, or
                pay with wallet / mock for demo.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap gap-2">
          {methods.map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              className="rounded-xl capitalize"
              variant={method === m ? 'default' : 'outline'}
              onClick={() => setMethod(m)}
            >
              {m === 'bank_transfer' ? 'Bank transfer' : m}
            </Button>
          ))}
        </div>

        {needsProof ? (
          <div className="space-y-2 rounded-2xl border border-dashed border-brand/30 bg-brand/5 p-4">
            <p className="text-sm font-semibold text-navy">Payment screenshot</p>
            <p className="text-xs text-muted-foreground">
              Required for bank / JazzCash / Easypaisa / card transfers. Company and admin will see
              this proof.
            </p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="block w-full text-sm"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            />
            {proofPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proofPreview}
                alt="Payment proof preview"
                className="mt-2 max-h-48 w-full rounded-xl object-contain bg-white"
              />
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button className="w-full rounded-xl" type="submit" disabled={loading || !slotId}>
          {loading ? 'Booking…' : `Pay ${formatPkr(advance)} advance & book`}
        </Button>
      </form>
    </div>
  );
}
