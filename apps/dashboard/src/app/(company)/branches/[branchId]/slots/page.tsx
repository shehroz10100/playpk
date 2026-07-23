'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Court = { id: string; name: string; sport: { name: string } };
type Slot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED' | 'MAINTENANCE';
  price: number;
};

const statusVariant: Record<Slot['status'], 'success' | 'danger' | 'warn' | 'muted'> = {
  AVAILABLE: 'success',
  BOOKED: 'danger',
  BLOCKED: 'muted',
  MAINTENANCE: 'warn',
};

/** 24-hour clock options (00–24) plus AM/PM helper. */
const HOURS_24 = Array.from({ length: 25 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function splitHm(value: string): { hour: string; minute: string } {
  const [hour = '00', minute = '00'] = value.split(':');
  return {
    hour: hour.padStart(2, '0').slice(0, 2),
    minute: minute.padStart(2, '0').slice(0, 2),
  };
}

function periodFromHour(hour: string): 'AM' | 'PM' {
  const h = Number(hour);
  if (!Number.isFinite(h) || h < 12 || h === 24) return 'AM';
  return 'PM';
}

function applyPeriod(hour: string, period: 'AM' | 'PM'): string {
  let h = Number(hour);
  if (!Number.isFinite(h)) h = 0;
  if (h === 24) return period === 'AM' ? '00' : '12';
  h = ((h % 24) + 24) % 24;
  if (period === 'AM') {
    if (h === 12) return '00';
    if (h > 12) return String(h - 12).padStart(2, '0');
    return String(h).padStart(2, '0');
  }
  if (h === 0) return '12';
  if (h < 12) return String(h + 12).padStart(2, '0');
  return String(h).padStart(2, '0');
}

function Time24Select({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { hour, minute } = splitHm(value);
  const period = periodFromHour(hour);
  const selectClass =
    'flex h-10 rounded-md border border-border bg-white px-2 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40';

  return (
    <div className="space-y-1">
      <Label htmlFor={`${id}-hour`}>{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          id={`${id}-hour`}
          aria-label={`${label} hour`}
          className={`${selectClass} min-w-[4.5rem]`}
          value={HOURS_24.includes(hour) ? hour : '00'}
          onChange={(e) => onChange(`${e.target.value}:${minute}`)}
        >
          {HOURS_24.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="text-sm font-medium text-muted-foreground">:</span>
        <select
          id={`${id}-minute`}
          aria-label={`${label} minute`}
          className={`${selectClass} min-w-[4.5rem]`}
          value={MINUTES_60.includes(minute) ? minute : '00'}
          onChange={(e) => onChange(`${hour}:${e.target.value}`)}
        >
          {MINUTES_60.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          id={`${id}-period`}
          aria-label={`${label} AM or PM`}
          className={`${selectClass} min-w-[4.25rem]`}
          value={period}
          onChange={(e) =>
            onChange(`${applyPeriod(hour, e.target.value as 'AM' | 'PM')}:${minute}`)
          }
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

export default function SlotsPage() {
  const params = useParams<{ branchId: string }>();
  const branchId = params.branchId;
  const [courts, setCourts] = useState<Court[]>([]);
  const [courtId, setCourtId] = useState('');
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [generateDays, setGenerateDays] = useState(14);
  const [manualStart, setManualStart] = useState('18:00');
  const [manualEnd, setManualEnd] = useState('19:00');
  const [manualPrice, setManualPrice] = useState('');
  const [showManual, setShowManual] = useState(false);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const loadCourts = useCallback(async () => {
    const { data } = await api<Court[]>(`/api/branches/${branchId}/courts`);
    setCourts(data);
    setCourtId((prev) => prev || data[0]?.id || '');
  }, [branchId]);

  const loadSlots = useCallback(
    async (activeCourtId = courtId, date = selectedDate) => {
      if (!activeCourtId) return;
      const { data } = await api<Slot[]>(`/api/slots/court/${activeCourtId}?date=${date}`);
      setSlots(data);
    },
    [courtId, selectedDate],
  );

  useEffect(() => {
    loadCourts().catch((err: Error) => setError(err.message));
  }, [loadCourts]);

  useEffect(() => {
    loadSlots().catch((err: Error) => setError(err.message));
  }, [loadSlots]);

  async function generateSlots() {
    if (!courtId) return;
    setBusy(true);
    setError(null);
    try {
      const startDate = format(new Date(), 'yyyy-MM-dd');
      const end = new Date();
      end.setDate(end.getDate() + generateDays - 1);
      await api('/api/slots/generate', {
        method: 'POST',
        body: JSON.stringify({
          courtId,
          startDate,
          endDate: format(end, 'yyyy-MM-dd'),
          durationMinutes: 60,
        }),
      });
      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setBusy(false);
    }
  }

  async function updateSlot(slotId: string, status: Slot['status']) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/slots/${slotId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function markHoliday() {
    if (!courtId) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/slots/holiday', {
        method: 'POST',
        body: JSON.stringify({ courtId, date: selectedDate }),
      });
      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Holiday mark failed');
    } finally {
      setBusy(false);
    }
  }

  async function createManualSlot() {
    if (!courtId) return;
    setBusy(true);
    setError(null);
    try {
      const priceNum = manualPrice.trim() ? Number(manualPrice) : undefined;
      if (priceNum !== undefined && (!Number.isFinite(priceNum) || priceNum <= 0)) {
        setError('Enter a valid price (PKR) or leave blank for court default.');
        return;
      }
      await api('/api/slots/manual', {
        method: 'POST',
        body: JSON.stringify({
          courtId,
          date: selectedDate,
          startTime: manualStart,
          endTime: manualEnd,
          ...(priceNum !== undefined ? { price: priceNum } : {}),
        }),
      });
      setShowManual(false);
      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create slot');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Slot calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monthly view per court. Click a date to add a manual slot, block, or mark maintenance.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label>Court</Label>
            <select
              className="flex h-10 min-w-52 rounded-md border border-border bg-white px-3 text-sm"
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
            >
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {court.name} ({court.sport.name})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Generate days</Label>
            <Input
              type="number"
              min={1}
              max={60}
              className="w-24"
              value={generateDays}
              onChange={(e) => setGenerateDays(Number(e.target.value))}
            />
          </div>
          <Button disabled={busy || !courtId} onClick={generateSlots}>
            Generate slots
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Slots follow this branch&apos;s open/close hours (including overnight, e.g. 06:00–04:00).
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{format(month, 'MMMM yyyy')}</CardTitle>
            <CardDescription>Select a day to manage its slots.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setMonth((m) => addMonths(m, -1))}>
              Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
              Next
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {days.map((day) => {
              const iso = format(day, 'yyyy-MM-dd');
              const selected = iso === selectedDate;
              const inMonth = isSameMonth(day, month);
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDate(iso)}
                  className={`rounded-lg border px-2 py-3 text-sm transition-colors ${
                    selected
                      ? 'border-brand bg-brand text-white'
                      : inMonth
                        ? 'border-border bg-white text-navy hover:border-brand/40'
                        : 'border-transparent bg-transparent text-muted-foreground'
                  }`}
                >
                  {format(day, 'd')}
                  {isSameDay(day, new Date()) && !selected ? (
                    <span className="mt-1 block text-[10px] text-brand">Today</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Slots for {selectedDate}</CardTitle>
            <CardDescription>
              {slots.length} slots · add a custom time or update availability
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !courtId}
              onClick={() => setShowManual((v) => !v)}
            >
              {showManual ? 'Cancel' : 'Add manual slot'}
            </Button>
            <Button variant="secondary" size="sm" disabled={busy || !courtId} onClick={markHoliday}>
              Mark holiday
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showManual ? (
            <form
              className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-5"
              onSubmit={(e) => {
                e.preventDefault();
                void createManualSlot();
              }}
            >
              <Time24Select
                id="manual-start"
                label="Start"
                value={manualStart}
                onChange={setManualStart}
              />
              <Time24Select
                id="manual-end"
                label="End"
                value={manualEnd}
                onChange={setManualEnd}
              />
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="manual-price">Price PKR (optional)</Label>
                <Input
                  id="manual-price"
                  type="number"
                  min={1}
                  placeholder="Court default"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                />
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-1">
                <Button type="submit" className="w-full" disabled={busy || !courtId}>
                  {busy ? 'Saving…' : 'Create slot'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">
                Creates one slot for <strong>{selectedDate}</strong> on the selected court. Use
                24-hour times (00–24). Overnight (e.g. 23:00–01:00) is allowed; overlaps are blocked.
              </p>
            </form>
          ) : null}

          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No slots for this day. Use <strong>Add manual slot</strong> or Generate slots.
            </p>
          ) : (
            slots.map((slot) => (
              <div
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-3"
              >
                <div>
                  <div className="font-medium text-navy">
                    {slot.startTime} – {slot.endTime}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatPkr(slot.price)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant[slot.status]}>{slot.status}</Badge>
                  {slot.status !== 'BOOKED' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => updateSlot(slot.id, 'AVAILABLE')}
                      >
                        Available
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => updateSlot(slot.id, 'MAINTENANCE')}
                      >
                        Maintenance
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => updateSlot(slot.id, 'BLOCKED')}
                      >
                        Block
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
