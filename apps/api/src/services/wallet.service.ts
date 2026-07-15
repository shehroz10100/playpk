import { WalletTxnType, type Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../lib/errors';

type Db = PrismaClient | Prisma.TransactionClient;

export async function topUpWallet(
  db: Db,
  input: { userId: string; amount: number; reason?: string },
) {
  if (input.amount <= 0) {
    throw new AppError('Top-up amount must be positive', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  const user = await db.user.update({
    where: { id: input.userId },
    data: { walletBalance: { increment: input.amount } },
  });

  await db.walletTransaction.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      type: WalletTxnType.TOPUP,
      reason: input.reason ?? 'Mock wallet top-up',
    },
  });

  return { walletBalance: Number(user.walletBalance), toppedUp: input.amount };
}

export async function debitWallet(
  db: Db,
  input: { userId: string; amount: number; bookingId: string; reason?: string },
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: input.userId } });
  const balance = Number(user.walletBalance);
  if (balance < input.amount) {
    throw new AppError('Insufficient wallet balance', {
      statusCode: 402,
      code: 'INSUFFICIENT_WALLET',
      details: { balance, required: input.amount },
    });
  }

  const updated = await db.user.update({
    where: { id: input.userId },
    data: { walletBalance: { decrement: input.amount } },
  });

  await db.walletTransaction.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      type: WalletTxnType.DEBIT,
      reason: input.reason ?? `Booking payment (${input.bookingId})`,
      bookingId: input.bookingId,
    },
  });

  return { walletBalance: Number(updated.walletBalance) };
}

export async function creditWalletRefund(
  db: Db,
  input: { userId: string; amount: number; bookingId: string },
) {
  const updated = await db.user.update({
    where: { id: input.userId },
    data: { walletBalance: { increment: input.amount } },
  });
  await db.walletTransaction.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      type: WalletTxnType.REFUND,
      reason: `Booking refund (${input.bookingId})`,
      bookingId: input.bookingId,
    },
  });
  return { walletBalance: Number(updated.walletBalance) };
}
