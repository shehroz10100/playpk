import { BookingStatus, PaymentStatus, Prisma, SlotStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

/**
 * Branch/company analytics aggregates + linear next-month revenue forecast.
 */
export async function getAnalytics(input: { branchId?: string; companyId?: string }) {
  if (!input.branchId && !input.companyId) {
    throw new AppError('branchId or companyId required', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const branchFilter: Prisma.BookingWhereInput = input.branchId
    ? { slot: { court: { branchId: input.branchId } } }
    : { slot: { court: { branch: { companyId: input.companyId! } } } };

  const slotFilter: Prisma.SlotWhereInput = input.branchId
    ? { court: { branchId: input.branchId } }
    : { court: { branch: { companyId: input.companyId! } } };

  const now = new Date();
  const lookbackStart = addMonths(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    -2,
  ); // start of month 2 months ago → 3 calendar months including current

  const bookings = await prisma.booking.findMany({
    where: {
      ...branchFilter,
      createdAt: { gte: lookbackStart },
    },
    include: {
      slot: {
        include: {
          court: {
            include: {
              sport: true,
              branch: { select: { id: true, name: true, city: true } },
            },
          },
        },
      },
    },
  });

  const slotsInWindow = await prisma.slot.findMany({
    where: {
      ...slotFilter,
      date: { gte: lookbackStart },
      status: { in: [SlotStatus.AVAILABLE, SlotStatus.BOOKED] },
    },
    select: { id: true, status: true, startTime: true, date: true },
  });

  let revenue = 0;
  let cancelled = 0;
  const userCounts = new Map<string, number>();
  const sportCounts = new Map<string, number>();
  const branchCounts = new Map<string, { name: string; count: number }>();
  const hourBooked = new Map<string, number>();
  const monthlyRevenue = new Map<string, number>();

  for (const b of bookings) {
    if (b.status === BookingStatus.CANCELLED) cancelled += 1;
    if (
      (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED) &&
      (b.paymentStatus === PaymentStatus.PAID ||
        b.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED)
    ) {
      const amt = Number(b.totalAmount);
      revenue += amt;
      const mk = monthKey(b.createdAt);
      monthlyRevenue.set(mk, (monthlyRevenue.get(mk) ?? 0) + amt);

      userCounts.set(b.userId, (userCounts.get(b.userId) ?? 0) + 1);

      const sport = b.slot.court.sport.name;
      sportCounts.set(sport, (sportCounts.get(sport) ?? 0) + 1);

      const br = b.slot.court.branch;
      const prev = branchCounts.get(br.id) ?? { name: br.name, count: 0 };
      prev.count += 1;
      branchCounts.set(br.id, prev);

      const hour = b.slot.startTime.slice(0, 2);
      hourBooked.set(hour, (hourBooked.get(hour) ?? 0) + 1);
    }
  }

  const totalSlots = slotsInWindow.length;
  const bookedSlots = slotsInWindow.filter((s) => s.status === SlotStatus.BOOKED).length;
  const occupancyPercent =
    totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 1000) / 10 : 0;

  const totalBookings = bookings.length;
  const cancellationRate =
    totalBookings > 0 ? Math.round((cancelled / totalBookings) * 1000) / 10 : 0;

  const returningCustomers = [...userCounts.values()].filter((c) => c > 1).length;
  const uniqueCustomers = userCounts.size;

  const peakHours = [...hourBooked.entries()]
    .map(([hour, count]) => ({ hour: `${hour}:00`, bookings: count }))
    .sort((a, b) => b.bookings - a.bookings);

  const topSport =
    [...sportCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topBranchEntry = [...branchCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  const topBranch = topBranchEntry
    ? { id: topBranchEntry[0], name: topBranchEntry[1].name, bookings: topBranchEntry[1].count }
    : null;

  // Build ordered last-3-months series
  const months: Array<{ month: string; revenue: number }> = [];
  for (let i = 0; i < 3; i += 1) {
    const m = addMonths(lookbackStart, i);
    const key = monthKey(m);
    months.push({ month: key, revenue: Math.round(monthlyRevenue.get(key) ?? 0) });
  }

  // Linear trend on last 3 months → next month
  const ys = months.map((m) => m.revenue);
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, i) => a + i * ys[i], 0);
  const sumXX = xs.reduce((a, i) => a + i * i, 0);
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const forecastRevenue = Math.max(0, Math.round(intercept + slope * n));
  const nextMonth = monthKey(addMonths(lookbackStart, 3));

  return {
    scope: {
      branchId: input.branchId ?? null,
      companyId: input.companyId ?? null,
    },
    window: {
      from: lookbackStart.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    },
    summary: {
      revenue: Math.round(revenue),
      currency: 'PKR',
      occupancyPercent,
      bookedSlots,
      totalSlots,
      cancellationRate,
      uniqueCustomers,
      returningCustomers,
      topSport,
      topBranch,
    },
    peakHours,
    revenueByMonth: months,
    forecast: {
      nextMonth,
      revenue: forecastRevenue,
      method: 'linear_trend_last_3_months',
      slope: Math.round(slope),
    },
  };
}
