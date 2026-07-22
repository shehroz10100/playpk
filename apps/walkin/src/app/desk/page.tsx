'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getSelectedBranch,
  getStoredUser,
} from '@/lib/auth';
import { getApiBase } from '@/lib/api-base';

type GridSlot = {
  id: string;
  courtId: string;
  startTime: string;
  endTime: string;
  status: string;
  price: number;
  booking: {
    id: string;
    source: string;
    customerName: string | null;
    customerPhone: string | null;
  } | null;
};

type GridResponse = {
  date: string;
  courts: Array<{ id: string; name: string; sport: { name: string }; pricePerHour: number }>;
  slots: GridSlot[];
};

type Branding = {
  branch: { id: string; name: string };
  company: { id: string; name: string };
  branding: {
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    businessName: string | null;
    receiptFooterText: string | null;
  };
};

type DaySummary = {
  date: string;
  walkInCount: number;
  revenue: number;
  byPaymentMethod: Record<string, { count: number; revenue: number }>;
};

type ReceiptBooking = {
  id: string;
  totalAmount: number;
  paymentMethod: string | null;
  guestName: string | null;
  guestPhone: string | null;
  user: { name: string; phone: string | null };
  slot: {
    startTime: string;
    endTime: string;
    date: string;
    court: { name: string; branch: { name: string; company: { name: string } } };
  };
};

type ResolvedPrice = {
  price: number;
  basePrice: number;
  appliedRuleLabel: string | null;
};

const PAYMENT_METHODS = ['CASH', 'JAZZCASH', 'EASYPAISA', 'CARD', 'WALLET'] as const;

function formatPkr(n: number) {
  return `Rs. ${Math.round(n).toLocaleString('en-PK')}`;
}

function cellTone(status: string): string {
  if (status === 'AVAILABLE') return 'bg-emerald-500/90 text-white hover:bg-emerald-600';
  if (status === 'BOOKED') return 'bg-red-500/90 text-white cursor-default';
  return 'bg-slate-400/80 text-white cursor-default';
}

export default function DeskPage() {
  const router = useRouter();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GridSlot | null>(null);
  const [customerName, setCustomerName] = useState('Walk-in Guest');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof PAYMENT_METHODS)[number]>('CASH');
  const [price, setPrice] = useState<ResolvedPrice | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptBooking | null>(null);
  const [liveFlash, setLiveFlash] = useState<string | null>(null);
  const staff = getStoredUser();

  const loadAll = useCallback(async (id: string) => {
    const [g, b, s] = await Promise.all([
      api<GridResponse>(`/api/walkin/branches/${id}/grid`),
      api<Branding>(`/api/walkin/branches/${id}/branding`),
      api<DaySummary>(`/api/walkin/branches/${id}/day-summary`),
    ]);
    setGrid(g);
    setBranding(b);
    setSummary(s);
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    const id = getSelectedBranch();
    if (!id) {
      router.replace('/login');
      return;
    }
    setBranchId(id);
    loadAll(id).catch((err: Error) => setError(err.message));
  }, [router, loadAll]);

  // Reliable SSE with Authorization via fetch + ReadableStream
  useEffect(() => {
    if (!branchId) return;
    const token = getAccessToken();
    if (!token) return;
    const controller = new AbortController();
    let cancelled = false;

    async function connect() {
      try {
        const res = await fetch(`${getApiBase()}/api/walkin/branches/${branchId}/events`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() ?? '';
          for (const chunk of chunks) {
            if (chunk.includes('event: slot')) {
              setLiveFlash('Slot updated live');
              void loadAll(branchId!);
              setTimeout(() => setLiveFlash(null), 2000);
            }
          }
        }
      } catch {
        /* aborted or network */
      }
    }
    void connect();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [branchId, loadAll]);

  useEffect(() => {
    if (!selected) {
      setPrice(null);
      return;
    }
    api<ResolvedPrice>(`/api/walkin/slots/${selected.id}/price`)
      .then(setPrice)
      .catch((err: Error) => setError(err.message));
  }, [selected]);

  const timeRows = useMemo(() => {
    if (!grid) return [];
    return [...new Set(grid.slots.map((s) => s.startTime))].sort();
  }, [grid]);

  const slotMap = useMemo(() => {
    const m = new Map<string, GridSlot>();
    for (const s of grid?.slots ?? []) m.set(`${s.courtId}|${s.startTime}`, s);
    return m;
  }, [grid]);

  async function confirmBooking() {
    if (!selected) return;
    setBookingBusy(true);
    setError(null);
    try {
      const booking = await api<ReceiptBooking>('/api/walkin/bookings', {
        method: 'POST',
        body: JSON.stringify({
          slotId: selected.id,
          customerName: customerName.trim() || 'Walk-in Guest',
          customerPhone: customerPhone.trim() || undefined,
          paymentMethod,
        }),
      });
      setReceipt(booking);
      setSelected(null);
      if (branchId) await loadAll(branchId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Booking failed');
    } finally {
      setBookingBusy(false);
    }
  }

  const primary = branding?.branding.primaryColor ?? '#00A651';
  const businessName =
    branding?.branding.businessName ?? branding?.company.name ?? 'PlayPK';

  if (!grid || !branding) {
    return <p className="p-8 text-sm text-navy/70">{error ?? 'Loading desk…'}</p>;
  }

  return (
    <div className="min-h-screen">
      <header
        className="no-print sticky top-0 z-20 border-b border-white/10 px-4 py-3 text-white shadow"
        style={{ background: `linear-gradient(120deg, ${primary}, ${branding.branding.secondaryColor})` }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {branding.branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.branding.logoUrl}
                alt=""
                className="h-10 w-10 rounded-lg bg-white/20 object-contain p-1"
              />
            ) : null}
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">{businessName}</h1>
              <p className="text-xs text-white/80">
                {branding.branch.name} · {staff?.name ?? 'Staff'} · {grid.date}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {liveFlash ? (
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs">{liveFlash}</span>
            ) : (
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs">Live</span>
            )}
            <button
              type="button"
              className="rounded-lg bg-white/15 px-3 py-2 text-sm hover:bg-white/25"
              onClick={() => branchId && loadAll(branchId)}
            >
              Refresh
            </button>
            <button
              type="button"
              className="rounded-lg bg-white/15 px-3 py-2 text-sm hover:bg-white/25"
              onClick={() => {
                clearSession();
                router.replace('/login');
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <section className="no-print overflow-auto rounded-2xl border border-navy/10 bg-white/90 shadow-sm">
          <div className="min-w-[720px]">
            <div
              className="grid border-b border-navy/10 bg-navy/[0.04] text-xs font-semibold uppercase tracking-wide text-navy/70"
              style={{ gridTemplateColumns: `100px repeat(${grid.courts.length}, minmax(110px, 1fr))` }}
            >
              <div className="p-3">Time</div>
              {grid.courts.map((c) => (
                <div key={c.id} className="border-l border-navy/10 p-3">
                  <div className="text-navy">{c.name}</div>
                  <div className="font-normal normal-case tracking-normal text-navy/50">
                    {c.sport.name}
                  </div>
                </div>
              ))}
            </div>
            {timeRows.map((time) => (
              <div
                key={time}
                className="grid border-b border-navy/5"
                style={{ gridTemplateColumns: `100px repeat(${grid.courts.length}, minmax(110px, 1fr))` }}
              >
                <div className="flex items-center p-2 text-sm font-medium text-navy/80">{time}</div>
                {grid.courts.map((court) => {
                  const slot = slotMap.get(`${court.id}|${time}`);
                  if (!slot) {
                    return (
                      <div key={court.id} className="border-l border-navy/5 bg-slate-100 p-1" />
                    );
                  }
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={slot.status !== 'AVAILABLE'}
                      onClick={() => setSelected(slot)}
                      className={`m-1 min-h-[52px] rounded-lg border-0 px-2 py-2 text-left text-xs font-medium transition ${cellTone(slot.status)}`}
                    >
                      <div>{slot.status === 'AVAILABLE' ? 'Open' : slot.status}</div>
                      {slot.booking ? (
                        <div className="mt-0.5 opacity-90">
                          <span className="rounded bg-black/20 px-1 text-[10px] uppercase">
                            {slot.booking.source}
                          </span>{' '}
                          {slot.booking.customerName}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="no-print rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
            <h2 className="font-display text-xl font-bold text-navy">Quick book</h2>
            {!selected ? (
              <p className="mt-2 text-sm text-navy/60">Tap a green slot to book a walk-in.</p>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-navy">
                  {selected.startTime}–{selected.endTime}
                </p>
                <label className="block text-sm">
                  Customer name
                  <input
                    className="mt-1 w-full rounded-xl border border-navy/15 px-3 py-2.5"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Phone (optional)
                  <input
                    className="mt-1 w-full rounded-xl border border-navy/15 px-3 py-2.5"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="03xx…"
                  />
                </label>
                <div>
                  <p className="text-sm font-medium">Payment</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                          paymentMethod === m
                            ? 'bg-navy text-white'
                            : 'bg-navy/5 text-navy hover:bg-navy/10'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl bg-brand/10 p-3">
                  <p className="text-xs text-navy/60">Resolved price (WALK_IN)</p>
                  <p className="text-2xl font-bold text-navy">
                    {price ? formatPkr(price.price) : '…'}
                  </p>
                  {price?.appliedRuleLabel ? (
                    <p className="text-xs text-navy/50">
                      base {formatPkr(price.basePrice)} + {price.appliedRuleLabel}
                    </p>
                  ) : null}
                </div>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <button
                  type="button"
                  disabled={bookingBusy}
                  onClick={() => void confirmBooking()}
                  className="w-full rounded-xl py-3.5 text-base font-semibold text-white disabled:opacity-60"
                  style={{ background: primary }}
                >
                  {bookingBusy ? 'Booking…' : 'Confirm walk-in'}
                </button>
                <button
                  type="button"
                  className="w-full text-sm text-navy/50"
                  onClick={() => setSelected(null)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="no-print rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-navy">End of day</h2>
            {summary ? (
              <div className="mt-2 space-y-2 text-sm">
                <p>
                  Walk-ins: <strong>{summary.walkInCount}</strong>
                </p>
                <p>
                  Revenue: <strong>{formatPkr(summary.revenue)}</strong>
                </p>
                <ul className="space-y-1 text-navy/70">
                  {Object.entries(summary.byPaymentMethod).map(([method, v]) => (
                    <li key={method}>
                      {method}: {v.count} · {formatPkr(v.revenue)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {receipt ? (
            <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm print:border-0 print:shadow-none">
              <div className="text-center">
                <h2 className="font-display text-2xl font-bold" style={{ color: primary }}>
                  {businessName}
                </h2>
                <p className="text-xs text-navy/60">{receipt.slot.court.branch.name}</p>
              </div>
              <div className="mt-4 space-y-1 border-t border-dashed border-navy/20 pt-4 text-sm">
                <p>
                  <strong>{receipt.guestName ?? receipt.user.name}</strong>
                </p>
                <p>
                  {receipt.slot.court.name} · {String(receipt.slot.date).slice(0, 10)} ·{' '}
                  {receipt.slot.startTime}–{receipt.slot.endTime}
                </p>
                <p className="text-lg font-bold">{formatPkr(Number(receipt.totalAmount))}</p>
                <p>Paid · {receipt.paymentMethod ?? 'CASH'}</p>
                <p className="text-xs text-navy/50">#{receipt.id.slice(-8)}</p>
              </div>
              {branding.branding.receiptFooterText ? (
                <p className="mt-4 text-center text-xs text-navy/50">
                  {branding.branding.receiptFooterText}
                </p>
              ) : null}
              <div className="no-print mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-navy py-2 text-sm text-white"
                  onClick={() => window.print()}
                >
                  Print
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-navy/15 py-2 text-sm"
                  onClick={() => setReceipt(null)}
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
