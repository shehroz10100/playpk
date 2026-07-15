import { z } from 'zod';
import { Router } from 'express';
import {
  CompanyApprovalStatus,
  DiscountType,
  TicketPriority,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { authenticate, requireRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendSuccess } from '../lib/errors';
import { param } from '../lib/params';
import * as admin from '../services/admin.service';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRoles(UserRole.ADMIN));

adminRouter.get('/users', async (req, res, next) => {
  try {
    const q = z
      .object({
        q: z.string().optional(),
        role: z.nativeEnum(UserRole).optional(),
        suspended: z
          .enum(['true', 'false'])
          .optional()
          .transform((v) => (v === undefined ? undefined : v === 'true')),
      })
      .parse(req.query);
    const data = await admin.listUsers(q);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/users/:userId/suspend', async (req, res, next) => {
  try {
    const data = await admin.setUserSuspended(param(req, 'userId'), true);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/users/:userId/unsuspend', async (req, res, next) => {
  try {
    const data = await admin.setUserSuspended(param(req, 'userId'), false);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/companies', async (req, res, next) => {
  try {
    const q = z
      .object({
        approvalStatus: z.nativeEnum(CompanyApprovalStatus).optional(),
      })
      .parse(req.query);
    const data = await admin.listCompaniesAdmin(q);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/companies/:companyId/approve', async (req, res, next) => {
  try {
    const data = await admin.approveCompany(param(req, 'companyId'), req.user!.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

adminRouter.post(
  '/companies/:companyId/reject',
  validate(z.object({ reason: z.string().max(500).optional() })),
  async (req, res, next) => {
    try {
      const data = await admin.rejectCompany(param(req, 'companyId'), req.body.reason);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },
);

adminRouter.patch(
  '/companies/:companyId/commission',
  validate(z.object({ commissionPercent: z.number().min(0).max(100) })),
  async (req, res, next) => {
    try {
      const data = await admin.updateCommission(
        param(req, 'companyId'),
        req.body.commissionPercent,
      );
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },
);

adminRouter.post('/branches/:branchId/approve', async (req, res, next) => {
  try {
    const data = await admin.approveBranch(param(req, 'branchId'));
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/reports', async (req, res, next) => {
  try {
    const q = z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(req.query);
    const data = await admin.platformReports(q);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/coupons', async (req, res, next) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const data = await admin.listCouponsAdmin(companyId);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

adminRouter.post(
  '/coupons',
  validate(
    z.object({
      companyId: z.string().min(1),
      code: z.string().min(2).max(32),
      discountType: z.nativeEnum(DiscountType),
      discountValue: z.number().positive(),
      validFrom: z.string(),
      validTo: z.string(),
      usageLimit: z.number().int().positive().optional(),
      active: z.boolean().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const data = await admin.createCoupon(req.body);
      sendSuccess(res, data, 201);
    } catch (error) {
      next(error);
    }
  },
);

adminRouter.patch(
  '/coupons/:couponId',
  validate(
    z.object({
      discountValue: z.number().positive().optional(),
      validFrom: z.string().optional(),
      validTo: z.string().optional(),
      usageLimit: z.number().int().positive().nullable().optional(),
      active: z.boolean().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const data = await admin.updateCoupon(param(req, 'couponId'), req.body);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },
);

adminRouter.get('/tickets', async (req, res, next) => {
  try {
    const q = z
      .object({
        status: z.nativeEnum(TicketStatus).optional(),
      })
      .parse(req.query);
    const data = await admin.listTickets(q);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch(
  '/tickets/:ticketId',
  validate(
    z.object({
      status: z.nativeEnum(TicketStatus).optional(),
      priority: z.nativeEnum(TicketPriority).optional(),
      assignedToId: z.string().nullable().optional(),
      adminNotes: z.string().max(2000).nullable().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const data = await admin.updateTicket(param(req, 'ticketId'), req.body);
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },
);

/** Auth user creates a support ticket (also under admin router? Better public support route) */
export const supportRouter = Router();

supportRouter.post(
  '/tickets',
  authenticate,
  validate(
    z.object({
      subject: z.string().min(3).max(160),
      body: z.string().min(5).max(4000),
      companyId: z.string().optional(),
      branchId: z.string().optional(),
      priority: z.nativeEnum(TicketPriority).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const data = await admin.createTicket({
        userId: req.user!.id,
        ...req.body,
      });
      sendSuccess(res, data, 201);
    } catch (error) {
      next(error);
    }
  },
);
