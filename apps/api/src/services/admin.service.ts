import {
  BookingStatus,
  CompanyApprovalStatus,
  DiscountType,
  PaymentStatus,
  TicketPriority,
  TicketStatus,
  UserRole,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { invalidateVenueListCache } from '../lib/cache-invalidate';

function serializeUser(u: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  loyaltyPoints: number;
  loyaltyTier: string;
  walletBalance: Prisma.Decimal | number;
  suspendedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    loyaltyPoints: u.loyaltyPoints,
    loyaltyTier: u.loyaltyTier,
    walletBalance: Number(u.walletBalance),
    suspendedAt: u.suspendedAt,
    createdAt: u.createdAt,
  };
}

export async function listUsers(filter: {
  q?: string;
  role?: UserRole;
  suspended?: boolean;
}) {
  const users = await prisma.user.findMany({
    where: {
      ...(filter.role ? { role: filter.role } : {}),
      ...(filter.suspended === true ? { suspendedAt: { not: null } } : {}),
      ...(filter.suspended === false ? { suspendedAt: null } : {}),
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: 'insensitive' } },
              { email: { contains: filter.q, mode: 'insensitive' } },
              { phone: { contains: filter.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return users.map(serializeUser);
}

export async function setUserSuspended(userId: string, suspend: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', { statusCode: 404, code: 'NOT_FOUND' });
  if (user.role === UserRole.ADMIN && suspend) {
    throw new AppError('Cannot suspend an admin account', { statusCode: 400, code: 'FORBIDDEN' });
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: suspend ? new Date() : null },
  });
  if (suspend) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  return serializeUser(updated);
}

function serializeCompany(c: {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  ownerId: string;
  approvalStatus: CompanyApprovalStatus;
  approvedAt: Date | null;
  rejectionReason: string | null;
  commissionPercent: Prisma.Decimal | number;
  createdAt: Date;
  owner?: { id: string; name: string; email: string | null };
  branches?: Array<{
    id: string;
    name: string;
    city: string;
    approvalStatus: CompanyApprovalStatus;
  }>;
}) {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    logoUrl: c.logoUrl,
    ownerId: c.ownerId,
    approvalStatus: c.approvalStatus,
    approvedAt: c.approvedAt,
    rejectionReason: c.rejectionReason,
    commissionPercent: Number(c.commissionPercent),
    createdAt: c.createdAt,
    owner: c.owner,
    branches: c.branches,
  };
}

export async function listCompaniesAdmin(filter: { approvalStatus?: CompanyApprovalStatus }) {
  const companies = await prisma.company.findMany({
    where: filter.approvalStatus ? { approvalStatus: filter.approvalStatus } : {},
    include: {
      owner: { select: { id: true, name: true, email: true } },
      branches: {
        select: { id: true, name: true, city: true, approvalStatus: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return companies.map(serializeCompany);
}

export async function approveCompany(companyId: string, adminId: string) {
  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      approvalStatus: CompanyApprovalStatus.APPROVED,
      approvedAt: new Date(),
      approvedById: adminId,
      rejectionReason: null,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      branches: { select: { id: true, name: true, city: true, approvalStatus: true } },
    },
  });
  await prisma.branch.updateMany({
    where: { companyId },
    data: { approvalStatus: CompanyApprovalStatus.APPROVED },
  });
  await invalidateVenueListCache();
  return serializeCompany({
    ...company,
    branches: company.branches.map((b) => ({
      ...b,
      approvalStatus: CompanyApprovalStatus.APPROVED,
    })),
  });
}

export async function rejectCompany(companyId: string, reason?: string) {
  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      approvalStatus: CompanyApprovalStatus.REJECTED,
      rejectionReason: reason ?? 'Rejected by platform admin',
      approvedAt: null,
      approvedById: null,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      branches: { select: { id: true, name: true, city: true, approvalStatus: true } },
    },
  });
  await prisma.branch.updateMany({
    where: { companyId },
    data: { approvalStatus: CompanyApprovalStatus.REJECTED },
  });
  await invalidateVenueListCache();
  return serializeCompany(company);
}

export async function approveBranch(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { company: true },
  });
  if (!branch) throw new AppError('Branch not found', { statusCode: 404, code: 'NOT_FOUND' });
  if (branch.company.approvalStatus !== CompanyApprovalStatus.APPROVED) {
    throw new AppError('Approve the company before approving branches', {
      statusCode: 409,
      code: 'COMPANY_NOT_APPROVED',
    });
  }
  const updated = await prisma.branch.update({
    where: { id: branchId },
    data: { approvalStatus: CompanyApprovalStatus.APPROVED },
  });
  await invalidateVenueListCache();
  return updated;
}

export async function updateCommission(companyId: string, commissionPercent: number) {
  if (commissionPercent < 0 || commissionPercent > 100) {
    throw new AppError('Commission must be 0–100', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  const company = await prisma.company.update({
    where: { id: companyId },
    data: { commissionPercent },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      branches: { select: { id: true, name: true, city: true, approvalStatus: true } },
    },
  });
  return serializeCompany(company);
}

export async function platformReports(input: { from?: string; to?: string }) {
  const now = new Date();
  const from = input.from
    ? new Date(`${input.from}T00:00:00.000Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const to = input.to
    ? new Date(`${input.to}T23:59:59.999Z`)
    : now;

  const bookings = await prisma.booking.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: {
      slot: {
        include: {
          court: {
            include: {
              branch: {
                include: {
                  company: true,
                },
              },
            },
          },
        },
      },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  let grossRevenue = 0;
  let platformCommission = 0;
  let paidBookings = 0;
  let cancelled = 0;
  const byCompany = new Map<
    string,
    { companyId: string; name: string; revenue: number; commission: number; bookings: number }
  >();
  const byDay = new Map<string, { date: string; revenue: number; bookings: number }>();

  for (const b of bookings) {
    if (b.status === BookingStatus.CANCELLED) cancelled += 1;
    const paid =
      (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED) &&
      (b.paymentStatus === PaymentStatus.PAID ||
        b.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED);
    if (!paid) continue;
    paidBookings += 1;
    const amount = Number(b.totalAmount);
    const company = b.slot.court.branch.company;
    const rate = Number(company.commissionPercent) / 100;
    const commission = Math.round(amount * rate);
    grossRevenue += amount;
    platformCommission += commission;

    const row = byCompany.get(company.id) ?? {
      companyId: company.id,
      name: company.name,
      revenue: 0,
      commission: 0,
      bookings: 0,
    };
    row.revenue += amount;
    row.commission += commission;
    row.bookings += 1;
    byCompany.set(company.id, row);

    const day = b.createdAt.toISOString().slice(0, 10);
    const d = byDay.get(day) ?? { date: day, revenue: 0, bookings: 0 };
    d.revenue += amount;
    d.bookings += 1;
    byDay.set(day, d);
  }

  const [userCount, companyCount, pendingCompanies, openTickets] = await Promise.all([
    prisma.user.count(),
    prisma.company.count({ where: { approvalStatus: CompanyApprovalStatus.APPROVED } }),
    prisma.company.count({ where: { approvalStatus: CompanyApprovalStatus.PENDING } }),
    prisma.supportTicket.count({
      where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } },
    }),
  ]);

  return {
    window: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    summary: {
      grossRevenue: Math.round(grossRevenue),
      platformCommission: Math.round(platformCommission),
      paidBookings,
      cancelledBookings: cancelled,
      totalBookings: bookings.length,
      users: userCount,
      approvedCompanies: companyCount,
      pendingCompanies,
      openTickets,
      currency: 'PKR',
    },
    revenueByCompany: [...byCompany.values()].sort((a, b) => b.revenue - a.revenue),
    revenueByDay: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    recentBookings: bookings.slice(0, 40).map((b) => ({
      id: b.id,
      status: b.status,
      paymentStatus: b.paymentStatus,
      paymentMethod: b.paymentMethod,
      paymentProofUrl: b.paymentProofUrl,
      totalAmount: Number(b.totalAmount),
      createdAt: b.createdAt,
      user: b.user,
      branch: b.slot.court.branch.name,
      company: b.slot.court.branch.company.name,
      commissionPercent: Number(b.slot.court.branch.company.commissionPercent),
    })),
  };
}

export async function listCouponsAdmin(companyId?: string) {
  const coupons = await prisma.coupon.findMany({
    where: companyId ? { companyId } : {},
    include: { company: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return coupons.map((c) => ({
    id: c.id,
    companyId: c.companyId,
    company: c.company,
    code: c.code,
    discountType: c.discountType,
    discountValue: Number(c.discountValue),
    validFrom: c.validFrom,
    validTo: c.validTo,
    usageLimit: c.usageLimit,
    usageCount: c.usageCount,
    active: c.active,
    createdAt: c.createdAt,
  }));
}

export async function createCoupon(input: {
  companyId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  validFrom: string;
  validTo: string;
  usageLimit?: number;
  active?: boolean;
}) {
  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) throw new AppError('Company not found', { statusCode: 404, code: 'NOT_FOUND' });

  const coupon = await prisma.coupon.create({
    data: {
      companyId: input.companyId,
      code: input.code.toUpperCase(),
      discountType: input.discountType,
      discountValue: input.discountValue,
      validFrom: new Date(input.validFrom),
      validTo: new Date(input.validTo),
      usageLimit: input.usageLimit,
      active: input.active ?? true,
    },
    include: { company: { select: { id: true, name: true } } },
  });
  return {
    id: coupon.id,
    companyId: coupon.companyId,
    company: coupon.company,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue),
    validFrom: coupon.validFrom,
    validTo: coupon.validTo,
    usageLimit: coupon.usageLimit,
    usageCount: coupon.usageCount,
    active: coupon.active,
    createdAt: coupon.createdAt,
  };
}

export async function updateCoupon(
  couponId: string,
  input: Partial<{
    discountValue: number;
    validFrom: string;
    validTo: string;
    usageLimit: number | null;
    active: boolean;
  }>,
) {
  const coupon = await prisma.coupon.update({
    where: { id: couponId },
    data: {
      ...(input.discountValue !== undefined ? { discountValue: input.discountValue } : {}),
      ...(input.validFrom !== undefined ? { validFrom: new Date(input.validFrom) } : {}),
      ...(input.validTo !== undefined ? { validTo: new Date(input.validTo) } : {}),
      ...(input.usageLimit !== undefined ? { usageLimit: input.usageLimit } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
    include: { company: { select: { id: true, name: true } } },
  });
  return {
    id: coupon.id,
    companyId: coupon.companyId,
    company: coupon.company,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue),
    validFrom: coupon.validFrom,
    validTo: coupon.validTo,
    usageLimit: coupon.usageLimit,
    usageCount: coupon.usageCount,
    active: coupon.active,
    createdAt: coupon.createdAt,
  };
}

export async function listTickets(filter: { status?: TicketStatus }) {
  const tickets = await prisma.supportTicket.findMany({
    where: filter.status ? { status: filter.status } : {},
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true, city: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
  return tickets;
}

export async function createTicket(input: {
  userId: string;
  subject: string;
  body: string;
  companyId?: string;
  branchId?: string;
  priority?: TicketPriority;
}) {
  return prisma.supportTicket.create({
    data: {
      userId: input.userId,
      subject: input.subject,
      body: input.body,
      companyId: input.companyId,
      branchId: input.branchId,
      priority: input.priority ?? TicketPriority.MEDIUM,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function updateTicket(
  ticketId: string,
  input: Partial<{
    status: TicketStatus;
    priority: TicketPriority;
    assignedToId: string | null;
    adminNotes: string | null;
  }>,
) {
  const data: Prisma.SupportTicketUpdateInput = {
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
    ...(input.assignedToId !== undefined
      ? input.assignedToId
        ? { assignedTo: { connect: { id: input.assignedToId } } }
        : { assignedTo: { disconnect: true } }
      : {}),
  };
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === TicketStatus.RESOLVED || input.status === TicketStatus.CLOSED) {
      data.resolvedAt = new Date();
    }
  }
  return prisma.supportTicket.update({
    where: { id: ticketId },
    data,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  });
}
