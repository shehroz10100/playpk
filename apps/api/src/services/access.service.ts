import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import type { AuthUser } from '../middleware/auth';

export async function assertCanManageCompany(user: AuthUser, companyId: string) {
  if (user.role === UserRole.ADMIN) return;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { branches: { select: { managerId: true } } },
  });
  if (!company) {
    throw new AppError('Company not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (user.role === UserRole.COMPANY_OWNER && company.ownerId === user.id) return;
  if (
    user.role === UserRole.BRANCH_MANAGER &&
    company.branches.some((b) => b.managerId === user.id)
  ) {
    return;
  }

  throw new AppError('Forbidden', { statusCode: 403, code: 'FORBIDDEN' });
}

export async function assertCanManageBranch(user: AuthUser, branchId: string) {
  if (user.role === UserRole.ADMIN) return;

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { company: true },
  });
  if (!branch) {
    throw new AppError('Branch not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  if (user.role === UserRole.COMPANY_OWNER && branch.company.ownerId === user.id) return;
  if (user.role === UserRole.BRANCH_MANAGER && branch.managerId === user.id) return;
  if (user.role === UserRole.FRONT_DESK && branch.managerId === user.id) return;

  throw new AppError('Forbidden', { statusCode: 403, code: 'FORBIDDEN' });
}

export async function listAccessibleCompanies(user: AuthUser) {
  if (user.role === UserRole.ADMIN) {
    return prisma.company.findMany({
      include: { branches: true, owner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  if (user.role === UserRole.COMPANY_OWNER) {
    return prisma.company.findMany({
      where: { ownerId: user.id },
      include: { branches: true, owner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  if (user.role === UserRole.BRANCH_MANAGER || user.role === UserRole.FRONT_DESK) {
    const branches = await prisma.branch.findMany({
      where: { managerId: user.id },
      include: {
        company: {
          include: { owner: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    const byCompany = new Map<
      string,
      (typeof branches)[number]['company'] & { branches: typeof branches }
    >();
    for (const b of branches) {
      const existing = byCompany.get(b.company.id);
      if (existing) {
        existing.branches.push(b);
      } else {
        byCompany.set(b.company.id, { ...b.company, branches: [b] });
      }
    }
    return [...byCompany.values()];
  }
  throw new AppError('Forbidden', { statusCode: 403, code: 'FORBIDDEN' });
}
