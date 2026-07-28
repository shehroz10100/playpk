'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { bookingAdvanceTotal } from '@/lib/booking-advance';
import { cn, formatPkr } from '@/lib/utils';
import { BookingStepPanel, BookingStepper } from '@/components/motion/booking-stepper';
import { StadiumSkeleton } from '@/components/motion/stadium-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useVisibilityPoll } from '@/hooks/use-visibility-poll';

type Slot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED' | 'MAINTENANCE';
  price: number;
};

type Availability = {
  court: {
    id: string;
    name: string;
    pricePerHour: number;
    basePricePerHour?: number;
    discountPercent?: number | null;
    indoor: boolean;
    hasAC: boolean;
    sport: { name: string };
    branch: { id: string; name: string; city: string };
  };
  slots: Slot[];
};

type DayChip = { iso: string; weekday: string; dayNum: string; month: string };

function nextSevenDays(): DayChip[] {
  const days: DayChip[] = [];
  const now = new Date();
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    days.push({
      iso: d.toISOString().slice(0, 10),
      weekday: weekdays[d.getUTCDay()],
      dayNum: String(d.getUTCDate()),
      month: months[d.getUTCMonth()],
    });
  }
  return days;
}

function toIsoDate(value: string): string {
  return value.slice(0, 10);
}

export default function CourtBookPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const days = useMemo(() => nextSevenDays(), []);
  const [selectedDate, setSelectedDate] = useState(days[0]?.iso ?? '');
  const [data, setData] = useState<Availability | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const { data: res } = await api<Availability>(
          `/api/slots/court/${params.id}/availability?days=7`,
          { auth: false },
        );
        const listRate = res.court.basePricePerHour ?? res.court.pricePerHour;
        const normalized = {
          ...res,
          court: {
            ...res.court,
            pricePerHour: listRate,
            basePricePerHour: listRate,
          },
          slots: res.slots.map((s) => ({
            ...s,
            date: toIsoDate(String(s.date)),
            price: s.status === 'AVAILABLE' ? listRate : Number(s.price),
          })),
        };
        setData(normalized);
        setError(null);
        setSelectedSlots((prev) =>
          prev
            .map((s) => normalized.slots.find((n) => n.id === s.id && n.status === 'AVAILABLE'))
            .filter((s): s is Slot => Boolean(s)),
        );
        setSelectedDate((current) => {
          if (normalized.slots.some((s) => s.date === current && s.status === 'AVAILABLE')) {
            return current;
          }
          const first = days.find((d) =>
            normalized.slots.some((s) => s.date === d.iso && s.status === 'AVAILABLE'),
          );
          return first?.iso ?? current;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load slots');
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [params.id, days],
  );

  useVisibilityPoll(() => void load({ silent: true }), Boolean(params.id), {
    intervalMs: 15000,
    immediate: false,
  });

  useEffect(() => {
    void load();
  }, [load]);

  const daySlots = (data?.slots ?? [])
    .filter((s) => s.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const selectedCourtTotal = selectedSlots.reduce((sum, s) => sum + s.price, 0);
  const selectedAdvance = bookingAdvanceTotal(selectedSlots.length);

  function toggleSlot(slot: Slot) {
    if (slot.status !== 'AVAILABLE') return;
    setSelectedSlots((prev) => {
      if (prev.some((s) => s.id === slot.id)) {
        return prev.filter((s) => s.id !== slot.id);
      }
      return [...prev, slot].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
  }

  function continueBooking() {
    if (!data || selectedSlots.length === 0) return;
    const sorted = [...selectedSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const total = sorted.reduce((sum, s) => sum + s.price, 0);
    const discount = data.court.discountPercent ?? null;
    const advance = bookingAdvanceTotal(sorted.length);
    const q = new URLSearchParams({
      slotIds: sorted.map((s) => s.id).join(','),
      slotId: sorted[0]!.id,
      courtName: data.court.name,
      branchName: data.court.branch.name,
      date: selectedDate,
      startTime: sorted[0]!.startTime,
      endTime: sorted[sorted.length - 1]!.endTime,
      total: String(total),
      advance: String(advance),
      times: sorted.map((s) => `${s.startTime}-${s.endTime}`).join(','),
      rates: sorted.map((s) => String(s.price)).join(','),
    });
    if (discount != null) q.set('discountPercent', String(discount));
    router.push(`/book/confirm?${q.toString()}`);
  }

  if (loading && !data) return <StadiumSkeleton className="mt-2" lines={4} />;
  if (error || !data) return <p className="text-sm text-red-600">{error ?? 'Court not found'}</p>;

  const bookingStep = selectedSlots.length > 0 ? 1 : 0;

  return (
    <div className="space-y-5 pb-44">
      <BookingStepper step={bookingStep} calm />

      <div>
        <Link
          href={`/venues/${data.court.branch.id}`}
          className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-navy"
        >
          ← {data.court.branch.name}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-navy">
          {data.court.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.court.sport.name} · rate {formatPkr(data.court.pricePerHour)}/hr · tap multiple
          slots
        </p>
        <div className="mt-2 flex gap-2">
          <Badge variant="success">{data.court.indoor ? 'Indoor' : 'Outdoor'}</Badge>
          <Badge variant="muted">{data.court.hasAC ? 'AC' : 'No AC'}</Badge>
        </div>
      </div>

      <BookingStepPanel stepKey={selectedDate}>
        <div>
          <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-tight text-navy">
            1 · Pick a date
          </h2>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {days.map((day) => {
              const active = day.iso === selectedDate;
              const count = data.slots.filter(
                (s) => s.date === day.iso && s.status === 'AVAILABLE',
              ).length;
              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => {
                    setSelectedDate(day.iso);
                    setSelectedSlots([]);
                  }}
                  className={cn(
                    'flex min-w-[4.5rem] shrink-0 cursor-pointer flex-col items-center rounded-xl border px-3 py-2.5 transition duration-200',
                    active
                      ? 'border-navy bg-navy text-white'
                      : 'border-navy/10 bg-white text-navy hover:border-navy/30',
                  )}
                >
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase',
                      !active && 'text-muted-foreground',
                    )}
                  >
                    {day.weekday}
                  </span>
                  <span className="text-xl font-extrabold leading-none">{day.dayNum}</span>
                  <span className="text-xs font-semibold">{day.month}</span>
                  <span
                    className={cn(
                      'mt-1 text-[10px]',
                      active ? 'text-white/90' : 'text-muted-foreground',
                    )}
                  >
                    {count > 0 ? `${count} open` : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-tight text-navy">
            2 · Pick slots
          </h2>
          {daySlots.length === 0 ? (
            <p className="rounded-xl border border-dashed border-navy/15 bg-white px-4 py-5 text-sm text-muted-foreground">
              No slots for this day.
            </p>
          ) : (
            daySlots.map((slot) => {
              const available = slot.status === 'AVAILABLE';
              const selected = selectedSlots.some((s) => s.id === slot.id);
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={!available}
                  onClick={() => toggleSlot(slot)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition duration-200',
                    selected
                      ? 'border-navy bg-navy/[0.04]'
                      : available
                        ? 'cursor-pointer border-navy/10 bg-white hover:border-navy/25'
                        : 'cursor-not-allowed border-navy/5 bg-white opacity-45',
                  )}
                >
                  <div>
                    <div className="font-semibold text-navy">
                      {slot.startTime} – {slot.endTime}
                    </div>
                    <div className="text-sm text-muted-foreground">{formatPkr(slot.price)}</div>
                  </div>
                  <Badge
                    variant={
                      slot.status === 'AVAILABLE'
                        ? 'success'
                        : slot.status === 'BOOKED'
                          ? 'danger'
                          : 'warn'
                    }
                  >
                    {slot.status}
                  </Badge>
                </button>
              );
            })
          )}
        </div>
      </BookingStepPanel>

      <div className="fixed inset-x-0 bottom-[5.25rem] z-50 border-t border-navy/10 bg-white/95 p-4 shadow-[0_-8px_24px_rgba(11,31,58,0.06)] backdrop-blur sm:bottom-[5.5rem]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Card className="border-0 bg-transparent shadow-none sm:flex-1">
            <CardContent className="p-0 text-sm text-muted-foreground">
              {selectedSlots.length > 0
                ? `${selectedDate} · ${selectedSlots.length} slot${selectedSlots.length === 1 ? '' : 's'} · court ${formatPkr(selectedCourtTotal)} · advance ${formatPkr(selectedAdvance)}`
                : 'Select a date and one or more available slots'}
            </CardContent>
          </Card>
          <Button
            className="h-11 w-full rounded-xl bg-brand font-bold text-white hover:bg-brand-600 sm:w-auto"
            disabled={selectedSlots.length === 0}
            onClick={continueBooking}
          >
            Continue · {formatPkr(selectedAdvance)} advance
          </Button>
        </div>
      </div>
    </div>
  );
}
