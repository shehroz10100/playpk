'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BOOKING_ADVANCE_PKR } from '@playpk/shared-types';
import { api } from '@/lib/api';
import { cn, formatPkr } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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

import { useVisibilityPoll } from '@/hooks/use-visibility-poll';

export default function CourtBookPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const days = useMemo(() => nextSevenDays(), []);
  const [selectedDate, setSelectedDate] = useState(days[0]?.iso ?? '');
  const [data, setData] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
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
        const normalized = {
          ...res,
          slots: res.slots.map((s) => ({ ...s, date: toIsoDate(String(s.date)) })),
        };
        setData(normalized);
        setError(null);
        setSelectedSlot((prev) => {
          if (!prev) return null;
          const still = normalized.slots.find((s) => s.id === prev.id && s.status === 'AVAILABLE');
          return still ?? null;
        });
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

  if (loading && !data) return <p className="text-sm text-muted-foreground">Loading slots…</p>;
  if (error || !data) return <p className="text-sm text-red-600">{error ?? 'Court not found'}</p>;

  return (
    <div className="space-y-5 pb-44">
      <div>
        <Link
          href={`/venues/${data.court.branch.id}`}
          className="text-sm font-medium text-brand hover:underline"
        >
          ← {data.court.branch.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-navy">{data.court.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.court.sport.name} · {data.court.branch.name} · court rate{' '}
          {formatPkr(data.court.pricePerHour)}/hr · advance {formatPkr(BOOKING_ADVANCE_PKR)}
        </p>
        <div className="mt-2 flex gap-2">
          <Badge variant="success">{data.court.indoor ? 'Indoor' : 'Outdoor'}</Badge>
          <Badge variant="muted">{data.court.hasAC ? 'AC' : 'No AC'}</Badge>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-navy">Next 7 days</h2>
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
                  setSelectedSlot(null);
                }}
                className={cn(
                  'flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-xl border-2 px-3 py-2.5 transition',
                  active
                    ? 'border-brand bg-brand text-white shadow-md shadow-brand/25'
                    : 'border-border bg-white text-navy hover:border-brand/40',
                )}
              >
                <span
                  className={cn('text-[10px] font-bold uppercase', !active && 'text-muted-foreground')}
                >
                  {day.weekday}
                </span>
                <span className="text-xl font-extrabold leading-none">{day.dayNum}</span>
                <span className="text-xs font-semibold">{day.month}</span>
                <span
                  className={cn('mt-1 text-[10px]', active ? 'text-white/90' : 'text-muted-foreground')}
                >
                  {count > 0 ? `${count} open` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {daySlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No slots for this day.</p>
        ) : (
          daySlots.map((slot) => {
            const available = slot.status === 'AVAILABLE';
            const selected = selectedSlot?.id === slot.id;
            return (
              <button
                key={slot.id}
                type="button"
                disabled={!available}
                onClick={() => setSelectedSlot(slot)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition',
                  selected
                    ? 'border-brand bg-brand-50'
                    : available
                      ? 'border-border bg-white hover:border-brand/40'
                      : 'cursor-not-allowed border-border bg-white opacity-45',
                )}
              >
                <div>
                  <div className="font-semibold text-navy">
                    {slot.startTime} – {slot.endTime}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Advance {formatPkr(BOOKING_ADVANCE_PKR)}
                    <span className="text-xs"> · rate {formatPkr(slot.price)}/hr</span>
                  </div>
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

      <div className="fixed inset-x-0 bottom-[4.75rem] z-50 border-t border-border bg-white/95 p-4 shadow-[0_-8px_24px_rgba(11,31,58,0.08)] backdrop-blur sm:bottom-[5rem]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Card className="border-0 bg-transparent shadow-none sm:flex-1">
            <CardContent className="p-0 text-sm text-muted-foreground">
              {selectedSlot
                ? `${selectedDate} · ${selectedSlot.startTime}-${selectedSlot.endTime} · advance ${formatPkr(BOOKING_ADVANCE_PKR)}`
                : 'Tap an available time slot to continue'}
            </CardContent>
          </Card>
          <Button
            className="w-full sm:w-auto"
            disabled={!selectedSlot}
            onClick={() =>
              router.push(
                `/book/confirm?slotId=${selectedSlot!.id}&courtName=${encodeURIComponent(data.court.name)}&branchName=${encodeURIComponent(data.court.branch.name)}&date=${selectedDate}&startTime=${selectedSlot!.startTime}&endTime=${selectedSlot!.endTime}&price=${BOOKING_ADVANCE_PKR}&rate=${selectedSlot!.price}`,
              )
            }
          >
            Continue to payment
          </Button>
        </div>
      </div>
    </div>
  );
}
