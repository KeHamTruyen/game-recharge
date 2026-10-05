import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get(
  '/status/:orderCode',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const transaction = await prisma.transaction.findFirst({
        where: {
          paymentOrderCode: req.params.orderCode,
          ...(req.user!.role === 'ADMIN' ? {} : { userId: req.user!.userId }),
        },
        select: { paymentStatus: true, status: true, paidAt: true },
      });
      if (!transaction) {
        res.status(404).json({ success: false, error: 'Payment not found' });
        return;
      }
      res.json({ success: true, data: transaction });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/webhook',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authorization = req.header('authorization');
      if (
        !env.SEPAY_API_KEY ||
        authorization !== `Apikey ${env.SEPAY_API_KEY}`
      ) {
        res.status(401).json({ success: false, error: 'Invalid webhook credentials' });
        return;
      }

      const payload = req.body as {
        id?: number;
        transferType?: string;
        transferAmount?: number;
        content?: string;
        referenceCode?: string;
        transactionDate?: string;
      };
      if (payload.transferType !== 'in' || !payload.transferAmount || !payload.content) {
        res.status(200).json({ success: true });
        return;
      }

      const orderCode = payload.content.match(/NEXA[A-Z0-9]+/)?.[0];
      if (!orderCode) {
        res.status(200).json({ success: true });
        return;
      }

      const transactions = await prisma.transaction.findMany({
        where: { paymentOrderCode: orderCode },
        select: { id: true, amount: true, paymentStatus: true, paymentMetadata: true },
      });
      const expectedAmount = transactions.reduce(
        (total, transaction) => total + Number(transaction.amount),
        0,
      );
      if (expectedAmount !== payload.transferAmount) {
        res.status(200).json({ success: true });
        return;
      }

      await prisma.$transaction(async (tx) => {
        if (payload.referenceCode) {
          const duplicate = await tx.transaction.findUnique({
            where: { bankTransactionId: payload.referenceCode },
            select: { id: true },
          });
          if (duplicate) return;
        }
        await tx.transaction.updateMany({
          where: {
            paymentOrderCode: orderCode,
            paymentStatus: { in: ['PENDING', 'UNPAID'] },
          },
          data: {
            paymentStatus: 'PAID',
            status: 'PROCESSING',
            paidAt: payload.transactionDate
              ? new Date(payload.transactionDate)
              : new Date(),
            paymentMetadata: payload,
            bankTransactionId: payload.referenceCode,
          },
        });
      });

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
