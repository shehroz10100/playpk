import { z } from 'zod';
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError, sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import { assertCanManageBranch } from '../services/access.service';
import { getStorageProvider } from '../services/storage/LocalDiskStorageProvider';
import { invalidateVenueListCache } from '../lib/cache-invalidate';

export const courtsRouter = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

courtsRouter.use(authenticate);

const courtBodySchema = z.object({
  sportId: z.string().min(1),
  name: z.string().min(2),
  capacity: z.coerce.number().int().positive().default(4),
  pricePerHour: z.coerce.number().positive(),
  indoor: z.coerce.boolean().default(true),
  hasAC: z.coerce.boolean().default(false),
  equipmentAvailable: z.array(z.string()).optional().default([]),
});

courtsRouter.get('/', async (req, res, next) => {
  try {
    const branchId = param(req, 'branchId');
    await assertCanManageBranch(req.user!, branchId);
    const courts = await prisma.court.findMany({
      where: { branchId },
      include: { sport: true },
      orderBy: { name: 'asc' },
    });
    sendSuccess(
      res,
      courts.map((c) => ({
        ...c,
        pricePerHour: Number(c.pricePerHour),
      })),
    );
  } catch (error) {
    next(error);
  }
});

courtsRouter.post(
  '/',
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  validate(courtBodySchema),
  async (req, res, next) => {
    try {
      const branchId = param(req, 'branchId');
      await assertCanManageBranch(req.user!, branchId);
      const sport = await prisma.sport.findUnique({ where: { id: req.body.sportId } });
      if (!sport) {
        throw new AppError('Sport not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      const court = await prisma.court.create({
        data: { branchId, ...req.body },
        include: { sport: true },
      });
      await invalidateVenueListCache();
      sendSuccess(res, { ...court, pricePerHour: Number(court.pricePerHour) }, 201);
    } catch (error) {
      next(error);
    }
  },
);

courtsRouter.patch(
  '/:courtId',
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  validate(courtBodySchema.partial()),
  async (req, res, next) => {
    try {
      const branchId = param(req, 'branchId');
      await assertCanManageBranch(req.user!, branchId);
      const existing = await prisma.court.findFirst({
        where: { id: param(req, 'courtId'), branchId },
      });
      if (!existing) {
        throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      const court = await prisma.court.update({
        where: { id: existing.id },
        data: req.body,
        include: { sport: true },
      });
      await invalidateVenueListCache();
      sendSuccess(res, { ...court, pricePerHour: Number(court.pricePerHour) });
    } catch (error) {
      next(error);
    }
  },
);

courtsRouter.post(
  '/:courtId/photos',
  requireRoles(UserRole.COMPANY_OWNER, UserRole.BRANCH_MANAGER, UserRole.ADMIN),
  upload.array('photos', 5),
  async (req, res, next) => {
    try {
      const branchId = param(req, 'branchId');
      await assertCanManageBranch(req.user!, branchId);
      const court = await prisma.court.findFirst({
        where: { id: param(req, 'courtId'), branchId },
      });
      if (!court) {
        throw new AppError('Court not found', { statusCode: 404, code: 'NOT_FOUND' });
      }

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) {
        throw new AppError('No photos uploaded', { statusCode: 400, code: 'VALIDATION_ERROR' });
      }

      const storage = getStorageProvider();
      const urls: string[] = [];
      for (const file of files) {
        const ext = file.mimetype.split('/')[1] ?? 'bin';
        const key = `courts/${court.id}/${randomUUID()}.${ext}`;
        const stored = await storage.putObject({
          key,
          body: file.buffer,
          contentType: file.mimetype,
        });
        urls.push(stored.url);
      }

      const updated = await prisma.court.update({
        where: { id: court.id },
        data: { photos: [...court.photos, ...urls] },
        include: { sport: true },
      });

      await invalidateVenueListCache();
      sendSuccess(res, { ...updated, pricePerHour: Number(updated.pricePerHour) });
    } catch (error) {
      next(error);
    }
  },
);
