import { BookingStatus, SlotStatus, type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { operatingWindows, slotsForDayWindow, toHourMinutes } from './slotHours';

function parseDateOnly(value: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new AppError('Invalid date', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  return d;
}

/**
 * Auto-generate slots for a court across a date range.
 * Skips timestamps that already exist (idempotent upsert-safe createMany skipDuplicates).
 * Supports overnight branch hours (closeTime before openTime, e.g. 18:00–02:00).
 */
export async function generateSlots(input: {
  courtId: string;
  startDate: string;
  endDate: string;
  openTime?: string;
  closeTime?: string;
  durationMinutes?: number;
  priceOverride?: number;
}) {
  const court = await prisma.court.findUnique({
    where: { id: input.courtId },
    include: { branch: true },
  });
  if (!court) {
    throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const openTime = input.openTime ?? court.branch.operatingHoursStart;
  const closeTime = input.closeTime ?? court.branch.operatingHoursEnd;
  const duration = input.durationMinutes ?? 60;
  const price = input.priceOverride ?? Number(court.pricePerHour);
  const windows = operatingWindows(openTime, closeTime);

  const start = parseDateOnly(input.startDate);
  const end = parseDateOnly(input.endDate);
  if (end < start) {
    throw new AppError('endDate must be on/after startDate', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const rows: Prisma.SlotCreateManyInput[] = [];
  for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    for (const window of windows) {
      for (const slot of slotsForDayWindow(window.start, window.endExclusiveMinutes, duration)) {
        rows.push({
          courtId: court.id,
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: SlotStatus.AVAILABLE,
          price,
        });
      }
    }
  }

  const result = await prisma.slot.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return {
    courtId: court.id,
    requested: rows.length,
    created: result.count,
    openTime,
    closeTime,
    overnight: toHourMinutes(closeTime) < toHourMinutes(openTime),
  };
}

/**
 * Create a single slot with custom start/end timing for a court on a date.
 * Rejects duplicate startTime and overlapping windows.
 */
export async function createManualSlot(input: {
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  price?: number;
  status?: SlotStatus;
}) {
  const court = await prisma.court.findUnique({ where: { id: input.courtId } });
  if (!court) {
    throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const startMin = toHourMinutes(input.startTime);
  let endMin = toHourMinutes(input.endTime);
  // Overnight slot on the same calendar date (e.g. 23:00–01:00)
  const overnight = endMin <= startMin;
  if (overnight) endMin += 24 * 60;
  if (endMin - startMin < 15) {
    throw new AppError('Slot must be at least 15 minutes', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (endMin - startMin > 12 * 60) {
    throw new AppError('Slot cannot exceed 12 hours', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const date = parseDateOnly(input.date);
  const existing = await prisma.slot.findMany({
    where: { courtId: court.id, date },
    select: { id: true, startTime: true, endTime: true },
  });

  for (const s of existing) {
    if (s.startTime === input.startTime) {
      throw new AppError('A slot already starts at this time', {
        statusCode: 409,
        code: 'SLOT_EXISTS',
      });
    }
    const sStart = toHourMinutes(s.startTime);
    let sEnd = toHourMinutes(s.endTime);
    if (sEnd <= sStart) sEnd += 24 * 60;
    const overlaps = startMin < sEnd && endMin > sStart;
    if (overlaps) {
      throw new AppError(
        `Overlaps existing slot ${s.startTime}–${s.endTime}`,
        { statusCode: 409, code: 'SLOT_OVERLAP' },
      );
    }
  }

  const created = await prisma.slot.create({
    data: {
      courtId: court.id,
      date,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status ?? SlotStatus.AVAILABLE,
      price: input.price ?? Number(court.pricePerHour),
    },
  });

  return {
    id: created.id,
    courtId: created.courtId,
    date: created.date.toISOString().slice(0, 10),
    startTime: created.startTime,
    endTime: created.endTime,
    status: created.status,
    price: Number(created.price),
  };
}

export async function searchSlots(input: {
  city?: string;
  sportId?: string;
  sport?: string;
  date?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.SlotWhereInput = {
    status: SlotStatus.AVAILABLE,
  };

  if (input.date) {
    where.date = parseDateOnly(input.date);
  }
  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    where.price = {
      ...(input.minPrice !== undefined ? { gte: input.minPrice } : {}),
      ...(input.maxPrice !== undefined ? { lte: input.maxPrice } : {}),
    };
  }

  where.court = {
    ...(input.sportId ? { sportId: input.sportId } : {}),
    ...(input.sport
      ? { sport: { name: { equals: input.sport, mode: 'insensitive' } } }
      : {}),
    branch: {
      ...(input.city ? { city: { equals: input.city, mode: 'insensitive' } } : {}),
      ...(input.minRating !== undefined
        ? {
            reviews: {
              some: {},
            },
          }
        : {}),
    },
  };

  const skip = (input.page - 1) * input.pageSize;

  const [total, slots] = await Promise.all([
    prisma.slot.count({ where }),
    prisma.slot.findMany({
      where,
      include: {
        court: {
          include: {
            sport: true,
            branch: {
              include: {
                reviews: { select: { rating: true } },
                company: { select: { id: true, name: true, logoUrl: true } },
              },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      skip,
      take: input.pageSize,
    }),
  ]);

  const data = slots
    .map((slot) => {
      const ratings = slot.court.branch.reviews.map((r) => r.rating);
      const avgRating =
        ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      if (input.minRating !== undefined && (avgRating === null || avgRating < input.minRating)) {
        return null;
      }
      return {
        id: slot.id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        price: Number(slot.price),
        status: slot.status,
        court: {
          id: slot.court.id,
          name: slot.court.name,
          indoor: slot.court.indoor,
          hasAC: slot.court.hasAC,
          photos: slot.court.photos,
          sport: slot.court.sport,
          branch: {
            id: slot.court.branch.id,
            name: slot.court.branch.name,
            city: slot.court.branch.city,
            address: slot.court.branch.address,
            avgRating,
            company: slot.court.branch.company,
          },
        },
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    data,
    meta: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize) || 1,
    },
  };
}

export async function listSlotsForCourtDate(courtId: string, date: string) {
  const slots = await prisma.slot.findMany({
    where: { courtId, date: parseDateOnly(date) },
    orderBy: { startTime: 'asc' },
    include: {
      bookings: {
        where: { status: { not: BookingStatus.CANCELLED } },
        select: { id: true, status: true, userId: true },
        take: 1,
      },
    },
  });
  return slots.map((s) => ({
    id: s.id,
    courtId: s.courtId,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    price: Number(s.price),
    booking: s.bookings[0] ?? null,
  }));
}

export async function updateSlotStatus(
  slotId: string,
  status: SlotStatus,
  price?: number,
) {
  const slot = await prisma.slot.findUnique({
    where: { id: slotId },
    include: {
      bookings: {
        where: { status: { not: BookingStatus.CANCELLED } },
        take: 1,
      },
    },
  });
  if (!slot) {
    throw new AppError('Slot not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (slot.bookings.length > 0 && status !== SlotStatus.BOOKED) {
    throw new AppError('Cannot change status of a booked slot; cancel booking first', {
      statusCode: 409,
      code: 'SLOT_HAS_BOOKING',
    });
  }

  const updated = await prisma.slot.update({
    where: { id: slotId },
    data: {
      status,
      ...(price !== undefined ? { price } : {}),
    },
  });

  return {
    id: updated.id,
    courtId: updated.courtId,
    date: updated.date,
    startTime: updated.startTime,
    endTime: updated.endTime,
    status: updated.status,
    price: Number(updated.price),
  };
}

/** Mark all available slots on a court/date as BLOCKED (holiday). */
export async function markHoliday(courtId: string, date: string) {
  const result = await prisma.slot.updateMany({
    where: {
      courtId,
      date: parseDateOnly(date),
      status: SlotStatus.AVAILABLE,
    },
    data: { status: SlotStatus.BLOCKED },
  });
  return { updated: result.count };
}
