import { LoyaltyTier, type PrismaClient, type Prisma } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Tier thresholds (total lifetime points):
 *   Bronze  0–499
 *   Silver  500–1,499
 *   Gold    1,500–4,999
 *   Diamond 5,000+
 */
export function calculateLoyaltyTier(totalPoints: number): LoyaltyTier {
  if (totalPoints >= 5000) return LoyaltyTier.DIAMOND;
  if (totalPoints >= 1500) return LoyaltyTier.GOLD;
  if (totalPoints >= 500) return LoyaltyTier.SILVER;
  return LoyaltyTier.BRONZE;
}

/** Award ~1 point per PKR 100 spent, minimum 10 points per completed booking. */
export function pointsForBookingAmount(amount: number): number {
  return Math.max(10, Math.floor(amount / 100));
}

export function nextTierProgress(totalPoints: number): {
  currentTier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  pointsToNext: number | null;
  thresholds: Record<LoyaltyTier, number>;
} {
  const thresholds = {
    BRONZE: 0,
    SILVER: 500,
    GOLD: 1500,
    DIAMOND: 5000,
  } as const;
  const currentTier = calculateLoyaltyTier(totalPoints);
  const order: LoyaltyTier[] = [
    LoyaltyTier.BRONZE,
    LoyaltyTier.SILVER,
    LoyaltyTier.GOLD,
    LoyaltyTier.DIAMOND,
  ];
  const idx = order.indexOf(currentTier);
  const nextTier = idx < order.length - 1 ? order[idx + 1] : null;
  const pointsToNext = nextTier ? thresholds[nextTier] - totalPoints : null;
  return { currentTier, nextTier, pointsToNext, thresholds: { ...thresholds } };
}

/**
 * Idempotent loyalty award keyed by bookingId in the reason/index.
 * Call after a booking is paid/confirmed.
 */
export async function awardLoyaltyForBooking(
  db: Db,
  input: { userId: string; bookingId: string; amount: number },
) {
  const existing = await db.loyaltyTransaction.findFirst({
    where: { userId: input.userId, bookingId: input.bookingId },
  });
  if (existing) {
    const user = await db.user.findUniqueOrThrow({ where: { id: input.userId } });
    return {
      awarded: 0,
      alreadyAwarded: true,
      loyaltyPoints: user.loyaltyPoints,
      loyaltyTier: user.loyaltyTier,
    };
  }

  const points = pointsForBookingAmount(input.amount);
  const user = await db.user.findUniqueOrThrow({ where: { id: input.userId } });
  const newTotal = user.loyaltyPoints + points;
  const tier = calculateLoyaltyTier(newTotal);

  await db.loyaltyTransaction.create({
    data: {
      userId: input.userId,
      points,
      reason: `Booking reward (${input.bookingId})`,
      bookingId: input.bookingId,
    },
  });

  const updated = await db.user.update({
    where: { id: input.userId },
    data: { loyaltyPoints: newTotal, loyaltyTier: tier },
  });

  return {
    awarded: points,
    alreadyAwarded: false,
    loyaltyPoints: updated.loyaltyPoints,
    loyaltyTier: updated.loyaltyTier,
  };
}
