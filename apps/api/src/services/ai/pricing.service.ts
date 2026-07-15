import { BookingStatus, PaymentStatus, SlotStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { getPricingModel } from './pricing';

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekendUtc(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function isPeakHour(startTime: string): boolean {
  const hour = Number(startTime.slice(0, 2));
  return hour >= 18 && hour < 21;
}

function weekdayHourKey(date: Date, startTime: string): string {
  return `${date.getUTCDay()}-${startTime.slice(0, 2)}`;
}

/**
 * Suggest prices for upcoming AVAILABLE slots on a court using the configured PricingModel.
 */
export async function suggestCourtPricing(input: {
  courtId: string;
  fromDate?: string;
  toDate?: string;
  holidayDates?: string[];
}) {
  const court = await prisma.court.findUnique({
    where: { id: input.courtId },
    include: { branch: true, sport: true },
  });
  if (!court) {
    throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const today = new Date();
  const from = input.fromDate
    ? new Date(`${input.fromDate}T00:00:00.000Z`)
    : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const to = input.toDate
    ? new Date(`${input.toDate}T00:00:00.000Z`)
    : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

  const holidaySet = new Set(input.holidayDates ?? []);

  // Infer holidays from already-BLOCKED slots in range if not provided
  if (holidaySet.size === 0) {
    const blocked = await prisma.slot.findMany({
      where: {
        courtId: court.id,
        status: SlotStatus.BLOCKED,
        date: { gte: from, lte: to },
      },
      select: { date: true },
    });
    for (const b of blocked) holidaySet.add(dateKey(b.date));
  }

  // Historical occupancy by weekday+hour over last 90 days
  const histFrom = new Date(from.getTime() - 90 * 24 * 60 * 60 * 1000);
  const historical = await prisma.slot.findMany({
    where: {
      courtId: court.id,
      date: { gte: histFrom, lt: from },
      status: { in: [SlotStatus.AVAILABLE, SlotStatus.BOOKED] },
    },
    select: { date: true, startTime: true, status: true },
  });

  const histBuckets = new Map<string, { total: number; booked: number }>();
  for (const s of historical) {
    const key = weekdayHourKey(s.date, s.startTime);
    const bucket = histBuckets.get(key) ?? { total: 0, booked: 0 };
    bucket.total += 1;
    if (s.status === SlotStatus.BOOKED) bucket.booked += 1;
    histBuckets.set(key, bucket);
  }

  const slots = await prisma.slot.findMany({
    where: {
      courtId: court.id,
      date: { gte: from, lte: to },
      status: SlotStatus.AVAILABLE,
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  const model = getPricingModel();
  const basePrice = Number(court.pricePerHour);

  const suggestions = slots.map((slot) => {
    const dk = dateKey(slot.date);
    const bucket = histBuckets.get(weekdayHourKey(slot.date, slot.startTime));
    const historicalOccupancy =
      bucket && bucket.total > 0 ? bucket.booked / bucket.total : null;

    return model.suggest({
      courtId: court.id,
      basePrice: Number(slot.price) || basePrice,
      slotId: slot.id,
      date: dk,
      startTime: slot.startTime,
      endTime: slot.endTime,
      flags: {
        isWeekend: isWeekendUtc(slot.date),
        isHoliday: holidaySet.has(dk),
        isPeakHour: isPeakHour(slot.startTime),
        historicalOccupancy,
      },
    });
  });

  // Avg paid booking price as context (last 90 days)
  const paid = await prisma.booking.aggregate({
    where: {
      slot: { courtId: court.id, date: { gte: histFrom, lt: from } },
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] },
    },
    _avg: { totalAmount: true },
    _count: { id: true },
  });

  return {
    court: {
      id: court.id,
      name: court.name,
      branchId: court.branchId,
      branchName: court.branch.name,
      sport: court.sport.name,
      basePrice,
    },
    model: model.name,
    range: { from: dateKey(from), to: dateKey(to) },
    historicalAvgPaidPrice: paid._avg.totalAmount ? Number(paid._avg.totalAmount) : null,
    historicalBookingCount: paid._count.id,
    suggestions,
  };
}
