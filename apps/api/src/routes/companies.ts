import { z } from 'zod';
import { Router } from 'express';
import { CompanyApprovalStatus, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError, sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import {
  assertCanManageCompany,
  listAccessibleCompanies,
} from '../services/access.service';

export const companiesRouter = Router();

companiesRouter.use(authenticate);

companiesRouter.get('/', async (req, res, next) => {
  try {
    const companies = await listAccessibleCompanies(req.user!);
    sendSuccess(
      res,
      companies.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        logoUrl: c.logoUrl,
        ownerId: c.ownerId,
        createdAt: c.createdAt,
        approvalStatus: 'approvalStatus' in c ? c.approvalStatus : undefined,
        commissionPercent:
          'commissionPercent' in c ? Number(c.commissionPercent) : undefined,
        branches: c.branches,
        owner: 'owner' in c ? c.owner : undefined,
      })),
    );
  } catch (error) {
    next(error);
  }
});

companiesRouter.post(
  '/',
  requireRoles(UserRole.COMPANY_OWNER, UserRole.ADMIN),
  validate(
    z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      logoUrl: z.string().url().optional(),
      ownerId: z.string().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const ownerId =
        req.user!.role === UserRole.ADMIN && req.body.ownerId
          ? req.body.ownerId
          : req.user!.id;

      const isAdmin = req.user!.role === UserRole.ADMIN;
      const company = await prisma.company.create({
        data: {
          ownerId,
          name: req.body.name,
          description: req.body.description,
          logoUrl: req.body.logoUrl,
          approvalStatus: isAdmin
            ? CompanyApprovalStatus.APPROVED
            : CompanyApprovalStatus.PENDING,
          approvedAt: isAdmin ? new Date() : null,
          approvedById: isAdmin ? req.user!.id : null,
          commissionPercent: 10,
        },
        include: { branches: true },
      });
      sendSuccess(
        res,
        {
          ...company,
          commissionPercent: Number(company.commissionPercent),
        },
        201,
      );
    } catch (error) {
      next(error);
    }
  },
);

companiesRouter.get('/:companyId', async (req, res, next) => {
  try {
    await assertCanManageCompany(req.user!, param(req, 'companyId'));
    const company = await prisma.company.findUnique({
      where: { id: param(req, 'companyId') },
      include: { branches: { orderBy: { createdAt: 'desc' } } },
    });
    if (!company) {
      throw new AppError('Company not found', { statusCode: 404, code: 'NOT_FOUND' });
    }
    sendSuccess(res, company);
  } catch (error) {
    next(error);
  }
});

companiesRouter.patch(
  '/:companyId',
  requireRoles(UserRole.COMPANY_OWNER, UserRole.ADMIN),
  validate(
    z.object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      logoUrl: z.string().url().nullable().optional(),
      bankAccountName: z.string().min(2).max(120).nullable().optional(),
      bankAccountNumber: z.string().min(5).max(64).nullable().optional(),
      bankName: z.string().min(2).max(120).nullable().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      await assertCanManageCompany(req.user!, param(req, 'companyId'));
      const company = await prisma.company.update({
        where: { id: param(req, 'companyId') },
        data: req.body,
      });
      sendSuccess(res, company);
    } catch (error) {
      next(error);
    }
  },
);

companiesRouter.post(
  '/:companyId/branches',
  requireRoles(UserRole.COMPANY_OWNER, UserRole.ADMIN),
  validate(
    z.object({
      name: z.string().min(2),
      city: z.string().min(2),
      address: z.string().min(5),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      operatingHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      operatingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      managerId: z.string().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      await assertCanManageCompany(req.user!, param(req, 'companyId'));
      const company = await prisma.company.findUnique({
        where: { id: param(req, 'companyId') },
      });
      if (!company) {
        throw new AppError('Company not found', { statusCode: 404, code: 'NOT_FOUND' });
      }
      const branch = await prisma.branch.create({
        data: {
          companyId: param(req, 'companyId'),
          ...req.body,
          approvalStatus: company.approvalStatus,
        },
      });
      sendSuccess(res, branch, 201);
    } catch (error) {
      next(error);
    }
  },
);
