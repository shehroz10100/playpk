'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type AuthUser } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { getApiBase } from '@/lib/api-base';
import { cn, formatPkr } from '@/lib/utils';
import { BookingStepper } from '@/components/motion/booking-stepper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type PayMethod = 'mock' | 'wallet' | 'jazzcash' | 'easypaisa' | 'card' | 'bank_transfer';

type PaymentInfo = {
  advanceAmount: number;
  amountDue?: number;
  company: {
    id: string;
    name: string;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
    bankName: string | null;
  };
};

const BANK_METHODS: PayMethod[] = ['bank_transfer', 'jazzcash', 'easypaisa', 'card'];

const METHOD_LABEL: Record<PayMethod, string> = {
  bank_transfer: 'Bank transfer',
  wallet: 'Wallet',
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
  card: 'Card',
  mock: 'Mock (demo)',
};

export default function BookConfirmPage() {
  const router = useRouter();
  const search = useSearchParams();

  const slotIds = useMemo(() => {
    const multi = search.get('slotIds');
    if (multi) {
      return multi.split(',').map((s) => s.trim()).filter(Boolean);
    }
    const single = search.get('slotId');
    return single ? [single] : [];
  }, [search]);

  const courtName = search.get('courtName') ?? '';
  const branchName = search.get('branchName') ?? '';
  const date = search.get('date') ?? '';
  const startTime = search.get('startTime') ?? '';
  const endTime = search.get('endTime') ?? '';

  const slotLines = useMemo(() => {
    const times = (search.get('times') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const rates = (search.get('rates') ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (times.length > 0) {
      return times.map((t, i) => ({
        label: t,
        price: rates[i] ?? 0,
      }));
    }
    if (startTime && endTime) {
      const rate = Number(search.get('rate') ?? search.get('price') ?? 0);
      return [{ label: `${startTime}–${endTime}`, price: rate }];
    }
    return [];
  }, [search, startTime, endTime]);

  const totalFromQuery = Number(search.get('total') ?? 0);
  const totalFromLines = slotLines.reduce((sum, s) => sum + s.price, 0);
  const fallbackRate = Number(search.get('rate') ?? search.get('price') ?? 0);
  const clientTotal =
    totalFromQuery > 0
      ? totalFromQuery
      : totalFromLines > 0
        ? totalFromLines
        : fallbackRate;

  const [method, setMethod] = useState<PayMethod>('bank_transfer');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [paymentInfoError, setPaymentInfoError] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountDue = paymentInfo?.amountDue ?? paymentInfo?.advanceAmount ?? clientTotal;

  const methods = useMemo<PayMethod[]>(
    () => ['bank_transfer', 'wallet', 'jazzcash', 'easypaisa', 'card', 'mock'],
    [],
  );

  const needsProof = BANK_METHODS.includes(method);
  const bank = paymentInfo?.company;
  const hasBankDetails = Boolean(
    bank?.bankAccountName || bank?.bankAccountNumber || bank?.bankName,
  );
  const step = needsProof && proofFile ? 3 : 2;

  useEffect(() => {
    api<AuthUser>('/api/auth/me')
      .then(({ data }) => setWalletBalance(data.walletBalance ?? null))
      .catch(() => setWalletBalance(null));
  }, []);

  useEffect(() => {
    if (slotIds.length === 0) return;
    setPaymentInfoError(null);
    const qs = new URLSearchParams({ slotIds: slotIds.join(',') });
    api<PaymentInfo>(`/api/bookings/payment-info?${qs.toString()}`)
      .then(({ data }) => {
        setPaymentInfo(data);
        setPaymentInfoError(null);
      })
      .catch((err: unknown) => {
        setPaymentInfo(null);
        setPaymentInfoError(
          err instanceof ApiError ? err.message : 'Could not load company bank details',
        );
      });
  }, [slotIds]);

  useEffect(() => {
    if (!proofFile) {
      setProofPreview(null);
      return;
    }
    const url = URL.createObjectURL(proofFile);
    setProofPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [proofFile]);

  async function copyAccountNumber() {
    if (!bank?.bankAccountNumber) return;
    try {
      await navigator.clipboard.writeText(bank.bankAccountNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

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
    if (slotIds.length === 0) {
      setError('Missing slot. Go back and pick a time again.');
      return;
    }
    if (method === 'wallet' && walletBalance != null && walletBalance < amountDue) {
      setError('Insufficient wallet balance for this booking.');
      return;
    }
    if (needsProof && !proofFile) {
      setError('Upload a screenshot of your payment transfer.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let paymentProofUrl: string | undefined;
      if (needsProof) {
        paymentProofUrl = await uploadProof();
      }
      const { data } = await api<{ id: string; ids?: string[] }>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          slotIds,
          paymentMethod: method,
          paymentProofUrl,
        }),
      });
      const bookedId = data.ids?.[0] ?? data.id;
      router.replace(`/my-bookings?booked=${bookedId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-28">
      <BookingStepper step={step} calm />

      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Checkout
        </p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-navy">
          Confirm &amp; pay
        </h1>
        <p className="text-sm text-muted-foreground">
          Total is the sum of selected slot prices after discount
          {slotIds.length > 1 ? ` (${slotIds.length} slots)` : ''}.
        </p>
      </header>

      <Card className="rounded-2xl border border-navy/8 bg-white shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base font-bold uppercase tracking-tight text-navy">
            {branchName || 'Venue'}
          </CardTitle>
          <CardDescription>{courtName || 'Court'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Date</span>
            <span className="text-right font-medium text-navy">{date || '—'}</span>
          </div>
          {slotLines.length > 0 ? (
            slotLines.map((line) => (
              <div key={line.label} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{line.label}</span>
                <span className="text-navy">{formatPkr(line.price)}</span>
              </div>
            ))
          ) : (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Slot</span>
              <span className="text-right font-medium text-navy">
                {startTime}–{endTime}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-navy/5 pt-2.5">
            <span className="font-semibold text-navy">Total due now</span>
            <span className="font-display text-xl font-bold text-navy">{formatPkr(amountDue)}</span>
          </div>
          {walletBalance != null ? (
            <p className="text-xs text-muted-foreground">Wallet balance: {formatPkr(walletBalance)}</p>
          ) : null}
        </CardContent>
      </Card>

      <form className="space-y-4" onSubmit={onSubmit}>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-navy">Payment method</legend>
          <div className="grid grid-cols-2 gap-2">
            {methods.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn(
                  'cursor-pointer rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition duration-200',
                  method === m
                    ? 'border-navy bg-navy text-white'
                    : 'border-navy/10 bg-white text-navy hover:border-navy/25',
                )}
              >
                {METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        </fieldset>

        {needsProof ? (
          <Card className="rounded-2xl border border-navy/8 bg-white shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-navy">Transfer details</CardTitle>
              <CardDescription>
                Send {formatPkr(amountDue)} to this company account, then upload your screenshot.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {hasBankDetails ? (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Account name</span>
                    <span className="text-right font-semibold text-navy">
                      {bank?.bankAccountName ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Account no.</span>
                    <div className="text-right">
                      <span className="block font-semibold tabular-nums text-navy">
                        {bank?.bankAccountNumber ?? '—'}
                      </span>
                      {bank?.bankAccountNumber ? (
                        <button
                          type="button"
                          onClick={() => void copyAccountNumber()}
                          className="mt-0.5 text-xs font-semibold text-brand hover:underline"
                        >
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Bank name</span>
                    <span className="text-right font-semibold text-navy">{bank?.bankName ?? '—'}</span>
                  </div>
                  <p className="pt-1 text-xs text-muted-foreground">Payable to {bank?.name}</p>
                </>
              ) : (
                <p className="text-sm text-amber-800">
                  {paymentInfoError
                    ? `Could not load bank details: ${paymentInfoError}`
                    : 'Bank details not set for this company yet. Ask the venue to save account name, number, and bank under Company → Bank account — or use wallet / mock for demo.'}
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {needsProof ? (
          <div className="space-y-2 rounded-2xl border border-navy/10 bg-[#F4F6F8] p-4">
            <p className="text-sm font-semibold text-navy">Payment screenshot</p>
            <p className="text-xs text-muted-foreground">
              Required for bank / JazzCash / Easypaisa / card. Venue staff see this on their bookings
              dashboard to verify payment.
            </p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="block w-full cursor-pointer text-sm text-navy"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            />
            {proofPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proofPreview}
                alt="Payment proof preview"
                className="mt-2 max-h-48 w-full rounded-xl bg-white object-contain"
              />
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button
          className="h-12 w-full rounded-xl bg-navy font-bold text-white hover:bg-navy-700"
          type="submit"
          disabled={loading || slotIds.length === 0}
        >
          {loading ? 'Processing…' : `Pay ${formatPkr(amountDue)}`}
        </Button>
      </form>
    </div>
  );
}
