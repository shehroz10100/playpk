import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import { assertCanManageCompany } from '../services/access.service';

export const brandingRouter = Router();

brandingRouter.use(authenticate);
brandingRouter.use(requireRoles(UserRole.COMPANY_OWNER, UserRole.ADMIN));

brandingRouter.get('/companies/:companyId', async (req, res, next) => {
  try {
    const companyId = param(req, 'companyId');
    await assertCanManageCompany(req.user!, companyId);
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: { branding: true },
    });
    sendSuccess(res, {
      companyId,
      branding: company.branding ?? {
        logoUrl: company.logoUrl,
        primaryColor: '#00A651',
        secondaryColor: '#0B1F3A',
        businessName: company.name,
        receiptFooterText: null,
      },
    });
  } catch (error) {
    next(error);
  }
});

brandingRouter.put(
  '/companies/:companyId',
  validate(
    z.object({
      logoUrl: z.string().nullable().optional(),
      primaryColor: z.string().min(4).max(32).optional(),
      secondaryColor: z.string().min(4).max(32).optional(),
      businessName: z.string().min(2).max(120).nullable().optional(),
      receiptFooterText: z.string().max(500).nullable().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const companyId = param(req, 'companyId');
      await assertCanManageCompany(req.user!, companyId);
      const branding = await prisma.brandingSettings.upsert({
        where: { companyId },
        create: {
          companyId,
          logoUrl: req.body.logoUrl ?? null,
          primaryColor: req.body.primaryColor ?? '#00A651',
          secondaryColor: req.body.secondaryColor ?? '#0B1F3A',
          businessName: req.body.businessName ?? null,
          receiptFooterText: req.body.receiptFooterText ?? null,
        },
        update: {
          ...(req.body.logoUrl !== undefined ? { logoUrl: req.body.logoUrl } : {}),
          ...(req.body.primaryColor !== undefined ? { primaryColor: req.body.primaryColor } : {}),
          ...(req.body.secondaryColor !== undefined
            ? { secondaryColor: req.body.secondaryColor }
            : {}),
          ...(req.body.businessName !== undefined ? { businessName: req.body.businessName } : {}),
          ...(req.body.receiptFooterText !== undefined
            ? { receiptFooterText: req.body.receiptFooterText }
            : {}),
        },
      });
      sendSuccess(res, branding);
    } catch (error) {
      next(error);
    }
  },
);
