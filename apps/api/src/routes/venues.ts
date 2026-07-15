import { z } from 'zod';
import { Router } from 'express';
import { CompanyApprovalStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, sendSuccess } from '../lib/errors';
import { param } from '../lib/params';

/**
 * Public venue discovery endpoints for the player mobile app.
 * Only APPROVED companies/branches are visible.
 */
export const venuesRouter = Router();

const approvedVenueWhere = {
  approvalStatus: CompanyApprovalStatus.APPROVED,
  company: { approvalStatus: CompanyApprovalStatus.APPROVED },
};

venuesRouter.get('/', async (req, res, next) => {
  try {
    const q = z
      .object({
        city: z.string().optional(),
        sportId: z.string().optional(),
        sport: z.string().optional(),
        minPrice: z.coerce.number().optional(),
        maxPrice: z.coerce.number().optional(),
        minRating: z.coerce.number().min(1).max(5).optional(),
        page: z.coerce.number().int().positive().default(1),
        pageSize: z.coerce.number().int().positive().max(50).default(20),
      })
      .parse(req.query);

    const branches = await prisma.branch.findMany({
      where: {
        ...approvedVenueWhere,
        ...(q.city ? { city: { equals: q.city, mode: 'insensitive' } } : {}),
        courts: {
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
        },
      },
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
        reviews: { select: { rating: true } },
        courts: {
          include: { sport: true },
          orderBy: { pricePerHour: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });

    const total = await prisma.branch.count({
      where: {
        ...approvedVenueWhere,
        ...(q.city ? { city: { equals: q.city, mode: 'insensitive' } } : {}),
        courts: { some: {} },
      },
    });

    const data = branches
      .map((branch) => {
        const ratings = branch.reviews.map((r) => r.rating);
        const avgRating =
          ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
        if (q.minRating !== undefined && (avgRating === null || avgRating < q.minRating)) {
          return null;
        }
        const prices = branch.courts.map((c) => Number(c.pricePerHour));
        const sports = [...new Map(branch.courts.map((c) => [c.sport.id, c.sport])).values()];
        const photos = [...new Set(branch.courts.flatMap((c) => c.photos))].slice(0, 6);
        return {
          id: branch.id,
          name: branch.name,
          city: branch.city,
          address: branch.address,
          latitude: branch.latitude,
          longitude: branch.longitude,
          company: branch.company,
          avgRating,
          reviewCount: ratings.length,
          minPrice: prices.length ? Math.min(...prices) : null,
          maxPrice: prices.length ? Math.max(...prices) : null,
          sports,
          photos,
          courtCount: branch.courts.length,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    sendSuccess(res, data, 200, {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize) || 1,
    });
  } catch (error) {
    next(error);
  }
});

venuesRouter.get('/:branchId', async (req, res, next) => {
  try {
    const branchId = param(req, 'branchId');
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

    sendSuccess(res, {
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
      courts: branch.courts.map((c) => ({
        id: c.id,
        name: c.name,
        capacity: c.capacity,
        pricePerHour: Number(c.pricePerHour),
        indoor: c.indoor,
        hasAC: c.hasAC,
        equipmentAvailable: c.equipmentAvailable,
        photos: c.photos,
        sport: c.sport,
      })),
    });
  } catch (error) {
    next(error);
  }
});

venuesRouter.get('/:branchId/courts/:courtId', async (req, res, next) => {
  try {
    const branchId = param(req, 'branchId');
    const courtId = param(req, 'courtId');
    const court = await prisma.court.findFirst({
      where: {
        id: courtId,
        branchId,
        branch: {
          approvalStatus: CompanyApprovalStatus.APPROVED,
          company: { approvalStatus: CompanyApprovalStatus.APPROVED },
        },
      },
      include: {
        sport: true,
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
            address: true,
            company: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!court) {
      throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
    }
    sendSuccess(res, {
      ...court,
      pricePerHour: Number(court.pricePerHour),
    });
  } catch (error) {
    next(error);
  }
});
