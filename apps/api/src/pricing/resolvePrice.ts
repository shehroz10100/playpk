import { PricingChannel, PricingDayType, type PricingRule } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export type PriceChannel = 'ONLINE' | 'WALK_IN';

export type ResolvedPrice = {
  price: number;
  basePrice: number;
  currency: 'PKR';
  channel: PriceChannel;
  dayType: PricingDayType;
  appliedRuleId: string | null;
  appliedRuleLabel: string | null;
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function dayTypeForDate(date: Date): PricingDayType {
  const day = date.getUTCDay(); // 0 Sun … 6 Sat
  return day === 0 || day === 6 ? PricingDayType.WEEKEND : PricingDayType.WEEKDAY;
}

function channelMatches(ruleChannel: PricingChannel, channel: PriceChannel): boolean {
  if (ruleChannel === PricingChannel.BOTH) return true;
  return ruleChannel === channel;
}

function timeOverlaps(ruleStart: string, ruleEnd: string, startTime: string): boolean {
  const t = toMinutes(startTime);
  const a = toMinutes(ruleStart);
  const b = toMinutes(ruleEnd);
  if (a === b) return true;
  if (a < b) return t >= a && t < b;
  // overnight window e.g. 22:00–02:00
  return t >= a || t < b;
}

function applyRule(base: number, rule: PricingRule): number {
  if (rule.priceOverride != null) return Number(rule.priceOverride);
  if (rule.priceMultiplier != null) {
    return Math.round(base * Number(rule.priceMultiplier) * 100) / 100;
  }
  return base;
}

/**
 * Single source of truth for slot pricing — online + walk-in must both call this.
 */
export async function resolvePrice(
  courtId: string,
  date: Date,
  startTime: string,
  channel: PriceChannel,
): Promise<ResolvedPrice> {
  const court = await prisma.court.findUnique({
    where: { id: courtId },
    include: { branch: true },
  });
  if (!court) {
    throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const basePrice = Number(court.pricePerHour);
  const dayType = dayTypeForDate(date);
  const now = new Date();

  const rules = await prisma.pricingRule.findMany({
    where: {
      companyId: court.branch.companyId,
      active: true,
      dayType,
      AND: [
        { OR: [{ branchId: null }, { branchId: court.branchId }] },
        { OR: [{ courtId: null }, { courtId: court.id }] },
        { OR: [{ sportId: null }, { sportId: court.sportId }] },
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validTo: null }, { validTo: { gte: now } }] },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  const matching = rules.filter(
    (r) => channelMatches(r.channel, channel) && timeOverlaps(r.timeRangeStart, r.timeRangeEnd, startTime),
  );

  const winner = matching[0] ?? null;
  const price = winner ? applyRule(basePrice, winner) : basePrice;

  return {
    price,
    basePrice,
    currency: 'PKR',
    channel,
    dayType,
    appliedRuleId: winner?.id ?? null,
    appliedRuleLabel: winner
      ? `${winner.dayType} ${winner.timeRangeStart}-${winner.timeRangeEnd} (${winner.channel})`
      : null,
  };
}
