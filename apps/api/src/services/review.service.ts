import { BookingStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

/**
 * Players may review a branch after at least one COMPLETED booking there.
 * One review per user/branch (upsert updates rating/comment).
 */
export async function upsertBranchReview(input: {
  userId: string;
  branchId: string;
  rating: number;
  comment?: string;
}) {
  if (input.rating < 1 || input.rating > 5) {
    throw new AppError('Rating must be 1–5', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
  if (!branch) {
    throw new AppError('Branch not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  const completed = await prisma.booking.findFirst({
    where: {
      userId: input.userId,
      status: BookingStatus.COMPLETED,
      slot: { court: { branchId: input.branchId } },
    },
  });

  if (!completed) {
    throw new AppError('Complete a booking at this venue before reviewing', {
      statusCode: 403,
      code: 'REVIEW_NOT_ELIGIBLE',
    });
  }

  const review = await prisma.review.upsert({
    where: {
      userId_branchId: { userId: input.userId, branchId: input.branchId },
    },
    update: {
      rating: input.rating,
      comment: input.comment,
    },
    create: {
      userId: input.userId,
      branchId: input.branchId,
      rating: input.rating,
      comment: input.comment,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  const agg = await prisma.review.aggregate({
    where: { branchId: input.branchId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    review,
    avgRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    reviewCount: agg._count.rating,
  };
}

export async function listBranchReviews(branchId: string) {
  const reviews = await prisma.review.findMany({
    where: { branchId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const agg = await prisma.review.aggregate({
    where: { branchId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return {
    reviews,
    avgRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    reviewCount: agg._count.rating,
  };
}
