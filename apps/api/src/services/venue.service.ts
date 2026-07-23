import { CompanyApprovalStatus, type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { cacheGet, cacheSet } from '../lib/cache';
import {
  applyPercentOff,
  getActiveSportDiscounts,
} from './sport-discount.service';

const approvedVenueWhere = {
  approvalStatus: CompanyApprovalStatus.APPROVED,
  company: { approvalStatus: CompanyApprovalStatus.APPROVED },
} satisfies Prisma.BranchWhereInput;

export type ListVenuesQuery = {
  city?: string;
  sportId?: string;
  sport?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  page: number;
  pageSize: number;
};

function courtSomeFilter(q: ListVenuesQuery): Prisma.CourtListRelationFilter {
  return {
    some: {
      ...(q.sportId ? { sportId: q.sportId } : {}),
      ...(q.sport ? { sport: { name: { equals: q.sport, mode: 'insensitive' } } } : {}),
      ...(q.minPrice !== undefined || q.maxPrice !== undefined
        ? {
            pricePerHour: {
              ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}),
              ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}),
            },
          }
        : {}),
    },
  };
}

async function buildVenueWhere(q: ListVenuesQuery): Promise<Prisma.BranchWhereInput> {
  const where: Prisma.BranchWhereInput = {
    ...approvedVenueWhere,
    ...(q.city ? { city: { equals: q.city, mode: 'insensitive' } } : {}),
    courts: courtSomeFilter(q),
  };

  if (q.minRating !== undefined) {
    const qualifying = await prisma.review.groupBy({
      by: ['branchId'],
      _avg: { rating: true },
      having: {
        rating: { _avg: { gte: q.minRating } },
      },
    });
    const ids = qualifying.map((r) => r.branchId);
    where.id = { in: ids };
  }

  return where;
}

function cacheKey(q: ListVenuesQuery): string {
  return `venues:list:${JSON.stringify(q)}`;
}

export async function listVenues(q: ListVenuesQuery) {
  const key = cacheKey(q);
  const cached = await cacheGet<{
    data: Awaited<ReturnType<typeof fetchVenues>>['data'];
    meta: Awaited<ReturnType<typeof fetchVenues>>['meta'];
  }>(key);
  if (cached) return cached;

  const result = await fetchVenues(q);
  await cacheSet(key, result, 120);
  return result;
}

async function fetchVenues(q: ListVenuesQuery) {
  const where = await buildVenueWhere(q);

  const [branches, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        latitude: true,
        longitude: true,
        company: { select: { id: true, name: true, logoUrl: true } },
        courts: {
          select: {
            pricePerHour: true,
            photos: true,
            sport: { select: { id: true, name: true, iconUrl: true } },
          },
          orderBy: { pricePerHour: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.branch.count({ where }),
  ]);

  const branchIds = branches.map((b) => b.id);
  const ratingAggs =
    branchIds.length > 0
      ? await prisma.review.groupBy({
          by: ['branchId'],
          where: { branchId: { in: branchIds } },
          _avg: { rating: true },
          _count: { rating: true },
        })
      : [];

  const ratingByBranch = new Map(
    ratingAggs.map((r) => [
      r.branchId,
      { avgRating: r._avg.rating, reviewCount: r._count.rating },
    ]),
  );

  const companyIds = [...new Set(branches.map((b) => b.company.id))];
  const activeDiscounts = await getActiveSportDiscounts(companyIds);
  const discountsByCompany = new Map<string, typeof activeDiscounts>();
  for (const d of activeDiscounts) {
    const list = discountsByCompany.get(d.companyId) ?? [];
    list.push(d);
    discountsByCompany.set(d.companyId, list);
  }

  const data = branches.map((branch) => {
    const companyDiscounts = discountsByCompany.get(branch.company.id) ?? [];
    const sportIds = new Set(branch.courts.map((c) => c.sport.id));
    const sportDiscounts = companyDiscounts.filter((d) => sportIds.has(d.sportId));
    const discountBySport = new Map(sportDiscounts.map((d) => [d.sportId, d.percentOff]));

    const prices = branch.courts.map((c) => {
      const base = Number(c.pricePerHour);
      const pct = discountBySport.get(c.sport.id);
      return pct != null ? applyPercentOff(base, pct) : base;
    });
    const sports = [...new Map(branch.courts.map((c) => [c.sport.id, c.sport])).values()];
    const photos = [...new Set(branch.courts.flatMap((c) => c.photos))].slice(0, 6);
    const rating = ratingByBranch.get(branch.id);
    const discountPercent =
      sportDiscounts.length > 0 ? Math.max(...sportDiscounts.map((d) => d.percentOff)) : null;

    return {
      id: branch.id,
      name: branch.name,
      city: branch.city,
      address: branch.address,
      latitude: branch.latitude,
      longitude: branch.longitude,
      company: branch.company,
      avgRating: rating?.avgRating ?? null,
      reviewCount: rating?.reviewCount ?? 0,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      sports,
      photos,
      courtCount: branch.courts.length,
      discountPercent,
      sportDiscounts: sportDiscounts.map((d) => ({
        sportId: d.sportId,
        sportName: d.sportName,
        percentOff: d.percentOff,
        label: d.label,
      })),
    };
  });

  return {
    data,
    meta: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize) || 1,
    },
  };
}

export async function getVenueDetail(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          description: true,
          approvalStatus: true,
        },
      },
      reviews: {
        select: { rating: true, comment: true, createdAt: true, user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      courts: {
        include: { sport: true },
        orderBy: { name: 'asc' },
      },
    },
  });
  if (
    !branch ||
    branch.approvalStatus !== CompanyApprovalStatus.APPROVED ||
    branch.company.approvalStatus !== CompanyApprovalStatus.APPROVED
  ) {
    throw new AppError('Venue not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const ratings = branch.reviews.map((r) => r.rating);
  const avgRating =
    ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const sports = [...new Map(branch.courts.map((c) => [c.sport.id, c.sport])).values()];
  const photos = [...new Set(branch.courts.flatMap((c) => c.photos))];

  const activeDiscounts = await getActiveSportDiscounts([branch.company.id]);
  const sportIds = new Set(branch.courts.map((c) => c.sportId));
  const sportDiscounts = activeDiscounts.filter((d) => sportIds.has(d.sportId));
  const discountBySport = new Map(sportDiscounts.map((d) => [d.sportId, d]));
  const discountPercent =
    sportDiscounts.length > 0 ? Math.max(...sportDiscounts.map((d) => d.percentOff)) : null;

  return {
    id: branch.id,
    name: branch.name,
    city: branch.city,
    address: branch.address,
    latitude: branch.latitude,
    longitude: branch.longitude,
    operatingHoursStart: branch.operatingHoursStart,
    operatingHoursEnd: branch.operatingHoursEnd,
    company: branch.company,
    avgRating,
    reviewCount: ratings.length,
    reviews: branch.reviews,
    sports,
    photos,
    discountPercent,
    sportDiscounts: sportDiscounts.map((d) => ({
      sportId: d.sportId,
      sportName: d.sportName,
      percentOff: d.percentOff,
      label: d.label,
    })),
    courts: branch.courts.map((c) => {
      const base = Number(c.pricePerHour);
      const disc = discountBySport.get(c.sportId);
      const pricePerHour = disc ? applyPercentOff(base, disc.percentOff) : base;
      return {
        id: c.id,
        name: c.name,
        capacity: c.capacity,
        pricePerHour,
        basePricePerHour: base,
        discountPercent: disc?.percentOff ?? null,
        indoor: c.indoor,
        hasAC: c.hasAC,
        equipmentAvailable: c.equipmentAvailable,
        photos: c.photos,
        sport: c.sport,
      };
    }),
  };
}
