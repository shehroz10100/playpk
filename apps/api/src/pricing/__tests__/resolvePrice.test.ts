import { PricingChannel, PricingDayType } from '@prisma/client';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    court: { findUnique: jest.fn() },
    pricingRule: { findMany: jest.fn() },
    sportDiscount: { findUnique: jest.fn() },
  },
}));

import { prisma } from '../../lib/prisma';
import { resolvePrice } from '../resolvePrice';

const mockedPrisma = prisma as unknown as {
  court: { findUnique: jest.Mock };
  pricingRule: { findMany: jest.Mock };
  sportDiscount: { findUnique: jest.Mock };
};

describe('resolvePrice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.court.findUnique.mockResolvedValue({
      id: 'court_1',
      pricePerHour: 3500,
      sportId: 'sport_1',
      branchId: 'branch_1',
      branch: { companyId: 'co_1', id: 'branch_1' },
    });
    mockedPrisma.sportDiscount.findUnique.mockResolvedValue(null);
  });

  it('returns identical price for ONLINE and WALK_IN when matching rule channel is BOTH', async () => {
    mockedPrisma.pricingRule.findMany.mockResolvedValue([
      {
        id: 'rule_1',
        channel: PricingChannel.BOTH,
        dayType: PricingDayType.WEEKEND,
        timeRangeStart: '17:00',
        timeRangeEnd: '23:00',
        priceOverride: null,
        priceMultiplier: 1.2,
        priority: 10,
      },
    ]);

    const date = new Date('2026-07-25T00:00:00.000Z'); // Saturday UTC
    const online = await resolvePrice('court_1', date, '19:00', 'ONLINE');
    const walkin = await resolvePrice('court_1', date, '19:00', 'WALK_IN');

    expect(online.price).toBe(4200);
    expect(walkin.price).toBe(4200);
    expect(online.appliedRuleId).toBe('rule_1');
    expect(walkin.appliedRuleId).toBe('rule_1');
  });

  it('applies highest priority matching rule', async () => {
    mockedPrisma.pricingRule.findMany.mockResolvedValue([
      {
        id: 'high',
        channel: PricingChannel.BOTH,
        dayType: PricingDayType.WEEKDAY,
        timeRangeStart: '00:00',
        timeRangeEnd: '23:59',
        priceOverride: 5000,
        priceMultiplier: null,
        priority: 100,
      },
      {
        id: 'low',
        channel: PricingChannel.BOTH,
        dayType: PricingDayType.WEEKDAY,
        timeRangeStart: '00:00',
        timeRangeEnd: '23:59',
        priceOverride: null,
        priceMultiplier: 2,
        priority: 1,
      },
    ]);

    const date = new Date('2026-07-22T00:00:00.000Z'); // Wednesday
    const resolved = await resolvePrice('court_1', date, '10:00', 'ONLINE');
    expect(resolved.price).toBe(5000);
    expect(resolved.appliedRuleId).toBe('high');
  });
});
