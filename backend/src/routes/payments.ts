import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const sePayWebhookSchema = z
  .object({
    id: z.coerce.number().optional(),
    gateway: z.string().max(100).optional(),
    transactionDate: z
      .string()
      .max(100)
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid transaction date format',
      }),
    accountNumber: z.string().max(50).optional(),
    subAccount: z.string().max(50).nullable().optional(),
    transferType: z.enum(['in', 'out']).optional().default('in'),
    transferAmount: z.coerce.number().nonnegative().optional(),
    accumulated: z.coerce.number().optional(),
    code: z.string().max(100).nullable().optional(),
    content: z.string().max(500).optional().default(''),
    referenceCode: z.string().max(100).nullable().optional(),
    description: z.string().max(500).nullable().optional(),
  })
  .passthrough();

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
      const authorization = req.header('authorization') || '';
      const expectedHeader = `Apikey ${env.SEPAY_API_KEY || ''}`;
      const isAuthValid =
        Boolean(env.SEPAY_API_KEY) &&
        crypto.timingSafeEqual(
          crypto.createHash('sha256').update(authorization).digest(),
          crypto.createHash('sha256').update(expectedHeader).digest()
        );
      if (!isAuthValid) {
        res.status(401).json({ success: false, error: 'Invalid webhook credentials' });
        return;
      }

      const parseResult = sePayWebhookSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid webhook payload structure',
          details: parseResult.error.flatten(),
        });
        return;
      }

      const payload = parseResult.data;
      if (payload.transferType !== 'in' || !payload.transferAmount || !payload.content) {
        res.status(200).json({ success: true });
        return;
      }

      const orderCode = payload.content.match(/(?:DUKE|NEXA)[A-Z0-9]+/i)?.[0]?.toUpperCase();
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
        // Concurrency lock per referenceCode or orderCode prevents simultaneous race conditions
        const lockKey = payload.referenceCode
          ? `sepay:ref:${payload.referenceCode}`
          : `sepay:order:${orderCode}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        if (payload.referenceCode) {
          const duplicate = await tx.transaction.findFirst({
            where: { bankTransactionId: payload.referenceCode },
            select: { id: true },
          });
          if (duplicate) return;
        }

        const paidAt =
          payload.transactionDate && !isNaN(Date.parse(payload.transactionDate))
            ? new Date(payload.transactionDate)
            : new Date();

        await tx.transaction.updateMany({
          where: {
            paymentOrderCode: orderCode,
            paymentStatus: { in: ['PENDING', 'UNPAID', 'EXPIRED'] },
          },
          data: {
            paymentStatus: 'PAID',
            status: 'PROCESSING',
            paidAt,
            paymentMetadata: payload as Prisma.InputJsonValue,
            bankTransactionId: payload.referenceCode || null,
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
