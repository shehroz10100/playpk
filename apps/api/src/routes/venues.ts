import { z } from 'zod';
import { Router } from 'express';
import { CompanyApprovalStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import * as venueService from '../services/venue.service';

/**
 * Public venue discovery endpoints for the player mobile app.
 * Only APPROVED companies/branches are visible.
 */
export const venuesRouter = Router();

const listQuerySchema = z.object({
  city: z.string().optional(),
  sportId: z.string().optional(),
  sport: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

venuesRouter.get('/', async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query);
    const { data, meta } = await venueService.listVenues(q);
    sendSuccess(res, data, 200, meta);
  } catch (error) {
    next(error);
  }
});

venuesRouter.get('/:branchId', async (req, res, next) => {
  try {
    const data = await venueService.getVenueDetail(param(req, 'branchId'));
    sendSuccess(res, data);
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
