'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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

export default function CourtBookPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const days = useMemo(() => nextSevenDays(), []);
  const [selectedDate, setSelectedDate] = useState(days[0]?.iso ?? '');
  const [data, setData] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<Availability>(`/api/slots/court/${params.id}/availability?days=7`, { auth: false })
      .then(({ data: res }) => {
        const normalized = {
          ...res,
          slots: res.slots.map((s) => ({ ...s, date: toIsoDate(s.date) })),
        };
        setData(normalized);
        const first = days.find((d) =>
          normalized.slots.some((s) => s.date === d.iso && s.status === 'AVAILABLE'),
        );
        if (first) setSelectedDate(first.iso);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id, days]);

  const daySlots = (data?.slots ?? [])
    .filter((s) => s.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (loading) return <p className="text-sm text-muted-foreground">Loading slots…</p>;
  if (error || !data) return <p className="text-sm text-red-600">{error ?? 'Court not found'}</p>;

  return (
    <div className="space-y-5 pb-28">
      <div>
        <Link
          href={`/venues/${data.court.branch.id}`}
          className="text-sm font-medium text-brand hover:underline"
        >
          ← {data.court.branch.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-navy">{data.court.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.court.sport.name} · {data.court.branch.name} · from{' '}
          {formatPkr(data.court.pricePerHour)}/hr
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
                <span className={cn('text-[10px] font-bold uppercase', !active && 'text-muted-foreground')}>
                  {day.weekday}
                </span>
                <span className="text-xl font-extrabold leading-none">{day.dayNum}</span>
                <span className="text-xs font-semibold">{day.month}</span>
                <span className={cn('mt-1 text-[10px]', active ? 'text-white/90' : 'text-muted-foreground')}>
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

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Card className="border-0 bg-transparent shadow-none sm:flex-1">
            <CardContent className="p-0 text-sm text-muted-foreground">
              {selectedSlot
                ? `${selectedDate} · ${selectedSlot.startTime}-${selectedSlot.endTime} · ${formatPkr(selectedSlot.price)}`
                : 'Tap an available time slot to continue'}
            </CardContent>
          </Card>
          <Button
            disabled={!selectedSlot}
            onClick={() =>
              router.push(
                `/book/confirm?slotId=${selectedSlot!.id}&courtName=${encodeURIComponent(data.court.name)}&branchName=${encodeURIComponent(data.court.branch.name)}&date=${selectedDate}&startTime=${selectedSlot!.startTime}&endTime=${selectedSlot!.endTime}&price=${selectedSlot!.price}`,
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
