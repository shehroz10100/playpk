import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export type SportDiscountDto = {
  id: string;
  companyId: string;
  sportId: string;
  sportName: string;
  percentOff: number;
  label: string | null;
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function isCurrentlyValid(d: {
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
}, now = new Date()): boolean {
  if (!d.active) return false;
  if (d.validFrom && d.validFrom > now) return false;
  if (d.validTo && d.validTo < now) return false;
  return true;
}

export function applyPercentOff(price: number, percentOff: number): number {
  const pct = Math.min(90, Math.max(0, percentOff));
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}

function mapDiscount(row: {
  id: string;
  companyId: string;
  sportId: string;
  percentOff: { toString(): string } | number;
  label: string | null;
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sport: { name: string };
}): SportDiscountDto {
  return {
    id: row.id,
    companyId: row.companyId,
    sportId: row.sportId,
    sportName: row.sport.name,
    percentOff: Number(row.percentOff),
    label: row.label,
    active: row.active,
    validFrom: row.validFrom,
    validTo: row.validTo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listSportDiscounts(companyId: string) {
  const rows = await prisma.sportDiscount.findMany({
    where: { companyId },
    include: { sport: { select: { name: true } } },
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
  });
  return rows.map(mapDiscount);
}

/** Active + in-date discounts for one or many companies (player-facing). */
export async function getActiveSportDiscounts(companyIds: string[]) {
  if (companyIds.length === 0) return [];
  const now = new Date();
  try {
    const rows = await prisma.sportDiscount.findMany({
      where: {
        companyId: { in: companyIds },
        active: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validTo: null }, { validTo: { gte: now } }] },
        ],
      },
      include: { sport: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      sportId: r.sportId,
      sportName: r.sport.name,
      percentOff: Number(r.percentOff),
      label: r.label,
    }));
  } catch (err) {
    // Local DBs that haven't migrated SportDiscount yet should still list venues.
    const code = (err as { code?: string } | null)?.code;
    if (code === 'P2021') return [];
    throw err;
  }
}

export async function findActiveSportDiscount(companyId: string, sportId: string) {
  const row = await prisma.sportDiscount.findUnique({
    where: { companyId_sportId: { companyId, sportId } },
    include: { sport: { select: { name: true } } },
  });
  if (!row || !isCurrentlyValid(row)) return null;
  return mapDiscount(row);
}

export async function upsertSportDiscount(input: {
  companyId: string;
  sportId: string;
  percentOff: number;
  label?: string | null;
  active?: boolean;
  validFrom?: Date | null;
  validTo?: Date | null;
}) {
  const sport = await prisma.sport.findUnique({ where: { id: input.sportId } });
  if (!sport) {
    throw new AppError('Sport not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const row = await prisma.sportDiscount.upsert({
    where: {
      companyId_sportId: { companyId: input.companyId, sportId: input.sportId },
    },
    create: {
      companyId: input.companyId,
      sportId: input.sportId,
      percentOff: input.percentOff,
      label: input.label?.trim() || null,
      active: input.active ?? true,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
    },
    update: {
      percentOff: input.percentOff,
      label: input.label === undefined ? undefined : input.label?.trim() || null,
      active: input.active ?? true,
      validFrom: input.validFrom === undefined ? undefined : input.validFrom,
      validTo: input.validTo === undefined ? undefined : input.validTo,
    },
    include: { sport: { select: { name: true } } },
  });
  return mapDiscount(row);
}

export async function updateSportDiscount(
  id: string,
  input: {
    percentOff?: number;
    label?: string | null;
    active?: boolean;
    validFrom?: Date | null;
    validTo?: Date | null;
  },
) {
  const row = await prisma.sportDiscount.update({
    where: { id },
    data: {
      ...(input.percentOff !== undefined ? { percentOff: input.percentOff } : {}),
      ...(input.label !== undefined ? { label: input.label?.trim() || null } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.validFrom !== undefined ? { validFrom: input.validFrom } : {}),
      ...(input.validTo !== undefined ? { validTo: input.validTo } : {}),
    },
    include: { sport: { select: { name: true } } },
  });
  return mapDiscount(row);
}

export async function deleteSportDiscount(id: string) {
  await prisma.sportDiscount.delete({ where: { id } });
  return { deleted: true };
}
