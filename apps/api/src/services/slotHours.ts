import { AppError } from '../lib/errors';

export const MINUTES_PER_DAY = 24 * 60;

export function toHourMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Format minutes-from-midnight (may wrap past 24h) as HH:mm on a 24h clock. */
export function formatClock(totalMinutes: number): string {
  const wrapped = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutes(time: string, minutes: number): string {
  return formatClock(toHourMinutes(time) + minutes);
}

/**
 * Daytime: 06:00–23:00 → one window.
 * Overnight: 06:00–04:00 → 06:00–24:00 and 00:00–04:00 (same calendar date).
 */
export function operatingWindows(
  openTime: string,
  closeTime: string,
): Array<{ start: string; endExclusiveMinutes: number }> {
  const open = toHourMinutes(openTime);
  const close = toHourMinutes(closeTime);
  if (open === close) {
    throw new AppError(
      'Opening and closing time cannot be the same. Use e.g. 06:00–23:00, or overnight 18:00–02:00.',
      { statusCode: 400, code: 'VALIDATION_ERROR' },
    );
  }
  if (close > open) {
    return [{ start: openTime, endExclusiveMinutes: close }];
  }
  return [
    { start: openTime, endExclusiveMinutes: MINUTES_PER_DAY },
    { start: '00:00', endExclusiveMinutes: close },
  ];
}

export function slotsForDayWindow(
  openTime: string,
  endExclusiveMinutes: number,
  duration: number,
): Array<{ startTime: string; endTime: string }> {
  const out: Array<{ startTime: string; endTime: string }> = [];
  let cursor = toHourMinutes(openTime);
  while (cursor + duration <= endExclusiveMinutes) {
    out.push({
      startTime: formatClock(cursor),
      endTime: formatClock(cursor + duration),
    });
    cursor += duration;
  }
  return out;
}
