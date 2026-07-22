import { randomUUID } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

/**
 * Resolve or create a lightweight GUEST user for walk-in / phone bookings.
 * - With phone: upsert by phone (GUEST role, no password)
 * - Without phone: unique synthetic email so we never collide on unique phone/email
 */
export async function resolveWalkInCustomer(input: {
  name?: string | null;
  phone?: string | null;
}): Promise<{ userId: string; guestName: string | null; guestPhone: string | null }> {
  const name = (input.name?.trim() || 'Walk-in Guest').slice(0, 120);
  const phone = input.phone?.trim() || null;

  if (phone) {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      if (existing.name !== name) {
        await prisma.user.update({ where: { id: existing.id }, data: { name } });
      }
      return { userId: existing.id, guestName: name, guestPhone: phone };
    }
    const created = await prisma.user.create({
      data: {
        name,
        phone,
        role: UserRole.GUEST,
        passwordHash: null,
      },
    });
    return { userId: created.id, guestName: name, guestPhone: phone };
  }

  const created = await prisma.user.create({
    data: {
      name,
      email: `walkin+${randomUUID()}@playpk.guest`,
      role: UserRole.GUEST,
      passwordHash: null,
    },
  });
  return { userId: created.id, guestName: name, guestPhone: null };
}
