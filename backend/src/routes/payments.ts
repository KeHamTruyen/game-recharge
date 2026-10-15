import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { formatTelegramOrderMessage } from '../utils/telegram.js';
import { flushTelegramNotifications } from '../utils/telegramQueue.js';
import { encryptSensitive } from '../utils/crypto.js';

const router = Router();

const sePayWebhookSchema = z
  .object({
    id: z.number().int().positive().safe(),
    gateway: z.string().max(100).optional(),
    transactionDate: z
      .string()
      .max(100)
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid transaction date format',
      }),
    accountNumber: z.string().trim().max(50).optional(),
    subAccount: z.string().max(50).nullable().optional(),
    transferType: z.enum(['in', 'out']),
    transferAmount: z.number().int().positive().safe(),
    accumulated: z.coerce.number().optional(),
    code: z.string().max(100).nullable().optional(),
    content: z.string().max(500),
    referenceCode: z.string().trim().max(100).nullable().optional(),
    description: z.string().max(500).nullable().optional(),
  })
  .strip();

router.get(
  '/status/:orderCode',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderCode = req.params.orderCode;
      const target = await prisma.transaction.findFirst({
        where: {
          OR: [{ paymentOrderCode: orderCode }, { code: orderCode }],
          ...(req.user!.role === 'ADMIN' ? {} : { userId: req.user!.userId }),
        },
        select: { paymentOrderCode: true, code: true },
      });
      if (!target) {
        res.status(404).json({ success: false, error: 'Payment not found' });
        return;
      }

      const des = target.paymentOrderCode || target.code;
      const groupOrders = await prisma.transaction.findMany({
        where: {
          OR: [{ paymentOrderCode: des }, { paymentOrderCode: null, code: des }],
          ...(req.user!.role === 'ADMIN' ? {} : { userId: req.user!.userId }),
        },
        select: { paymentStatus: true, status: true, paidAt: true },
      });

      if (!groupOrders.length) {
        res.status(404).json({ success: false, error: 'Payment not found' });
        return;
      }

      const allPaid = groupOrders.every((row) => row.paymentStatus === 'PAID');
      const allCompleted = groupOrders.every((row) => row.status === 'COMPLETED');
      const anyRefunded = groupOrders.some((row) => row.paymentStatus === 'REFUNDED' || row.status === 'REFUNDED');
      const anyFailed = groupOrders.some((row) => row.paymentStatus === 'FAILED' || row.status === 'FAILED');
      const allExpired = groupOrders.every((row) => row.paymentStatus === 'EXPIRED');

      let paymentStatus: string = 'PENDING';
      let status: string = 'PENDING';
      let paidAt: Date | null = null;

      if (allPaid) {
        paymentStatus = 'PAID';
        if (groupOrders.some((row) => row.status === 'FAILED')) {
          status = 'FAILED';
        } else if (groupOrders.some((row) => row.status === 'REFUNDED')) {
          status = 'REFUNDED';
        } else if (allCompleted) {
          status = 'COMPLETED';
        } else {
          status = 'PROCESSING';
        }
        const sortedPaidDates = groupOrders
          .map((row) => row.paidAt)
          .filter((d): d is Date => Boolean(d))
          .sort((a, b) => b.getTime() - a.getTime());
        paidAt = sortedPaidDates[0] || new Date();
      } else if (anyRefunded) {
        paymentStatus = 'REFUNDED';
        status = 'REFUNDED';
      } else if (allExpired) {
        paymentStatus = 'EXPIRED';
        status = 'FAILED';
      } else if (anyFailed && !groupOrders.some((row) => row.paymentStatus === 'PAID')) {
        paymentStatus = 'FAILED';
        status = 'FAILED';
      } else {
        const anyPending = groupOrders.some((row) => row.paymentStatus === 'PENDING');
        paymentStatus = anyPending || groupOrders.some((row) => row.paymentStatus === 'PAID')
          ? 'PENDING'
          : groupOrders[0].paymentStatus;
        if (groupOrders.some((row) => row.status === 'FAILED')) {
          status = 'FAILED';
        } else if (groupOrders.some((row) => row.status === 'PROCESSING')) {
          status = 'PROCESSING';
        } else {
          status = 'PENDING';
        }
      }

      res.json({
        success: true,
        data: {
          paymentStatus,
          status,
          paidAt,
        },
      });
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
        });
        return;
      }

      const payload = parseResult.data;
      if (!env.SEPAY_ACCOUNT_NUMBER) {
        res.status(503).json({ success: false, error: 'Payment account is not configured' });
        return;
      }

      // Strictly verify transferType is inbound ('in')
      if (payload.transferType !== 'in') {
        res.status(200).json({ success: true, ignored: true, reason: 'Non-inbound transfer' });
        return;
      }

      const configuredAccount = env.SEPAY_ACCOUNT_NUMBER.trim();
      const contentCode = payload.content.match(/DUKE[A-Z0-9]+/i)?.[0]?.toUpperCase();
      const gatewayId = String(payload.id);
      const referenceCode = payload.referenceCode || null;
      const settled = await prisma.$transaction(async (tx) => {
        // Serialize by event ID first, even if a retry changes or omits its reference.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sepay:id:${gatewayId}`}))`;
        if (await tx.paymentReceipt.findUnique({ where: { provider_externalId: { provider: 'sepay', externalId: gatewayId } } }) ||
            await tx.paymentAnomaly.findFirst({ where: { provider: 'sepay', gatewayId } })) return;

        if (referenceCode) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sepay:ref:${referenceCode}`}))`;
          const recordedAnomaly = await tx.paymentAnomaly.findFirst({
            where: { provider: 'sepay', referenceCode, accountNumber: payload.accountNumber || null },
          });
          if (recordedAnomaly) return;
        }

        let orderCode = contentCode;
        const recordAnomaly = async (anomalyType: string, expectedAmount?: Prisma.Decimal) => {
          await tx.paymentAnomaly.create({ data: {
            provider: 'sepay', gatewayId, referenceCode, orderCode,
            accountNumber: payload.accountNumber || null,
            amount: payload.transferAmount, expectedAmount, content: payload.content,
            anomalyType, rawPayload: payload as Prisma.InputJsonValue,
          } });
        };
        if (!payload.accountNumber || payload.accountNumber !== configuredAccount) {
          await recordAnomaly('MISMATCHED_ACCOUNT');
          return;
        }
        // The same bank reference is a redelivery, not another incoming payment.
        if (referenceCode && await tx.transaction.findFirst({ where: { bankTransactionId: referenceCode } })) return;
        if (!orderCode) {
          await recordAnomaly('NO_ORDER_CODE');
          return;
        }
        const matched = await tx.transaction.findFirst({
          where: { OR: [{ paymentOrderCode: orderCode }, { code: orderCode }] },
          select: { code: true, paymentOrderCode: true },
        });
        if (!matched) {
          await recordAnomaly('ORDER_NOT_FOUND');
          return;
        }
        orderCode = matched.paymentOrderCode || matched.code;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sepay:order:${orderCode}`}))`;
        // Lock the rows too: manual admin updates use row locks, not advisory locks.
        await tx.$queryRaw`SELECT id FROM transactions WHERE "paymentOrderCode" = ${orderCode}
          OR ("paymentOrderCode" IS NULL AND code = ${orderCode}) ORDER BY id FOR UPDATE`;
        const transactions = await tx.transaction.findMany({
          where: { OR: [{ paymentOrderCode: orderCode }, { paymentOrderCode: null, code: orderCode }] },
          select: {
            id: true, amount: true, paymentStatus: true, packageName: true,
            gameName: true, userEmail: true, topupInfo: true, topupLabels: true, topupFields: true,
          },
        });
        if (!transactions.length) {
          await recordAnomaly('ORDER_NOT_FOUND');
          return;
        }
        const expectedAmount = transactions.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
        if (transactions.some((row) => row.paymentStatus === 'PAID' || row.paymentStatus === 'REFUNDED')) {
          await recordAnomaly('DUPLICATE_PAYMENT', expectedAmount);
          return;
        }
        if (transactions.some((row) => row.paymentStatus === 'FAILED')) {
          await recordAnomaly('PAYMENT_NOT_PAYABLE', expectedAmount);
          return;
        }
        if (!expectedAmount.equals(payload.transferAmount)) {
          await recordAnomaly('AMOUNT_MISMATCH', expectedAmount);
          return;
        }
        await tx.paymentReceipt.create({
          data: { provider: 'sepay', externalId: gatewayId, paymentOrderCode: orderCode },
        });
        const paidAt = payload.transactionDate ? new Date(payload.transactionDate) : new Date();
        const where = { id: { in: transactions.map((item) => item.id) } };
        await tx.transaction.updateMany({
          where: { ...where, status: 'PENDING' }, data: { status: 'PROCESSING' },
        });
        await tx.transaction.updateMany({
          where,
          data: { paymentStatus: 'PAID', paidAt, paymentMetadata: payload as Prisma.InputJsonValue, bankTransactionId: referenceCode },
        });
        await tx.telegramNotification.createMany({
          data: transactions.map((item) => ({
            id: item.id,
            message: encryptSensitive(formatTelegramOrderMessage({
              orderCode: orderCode!, amount: Number(item.amount),
              packageName: item.packageName, gameName: item.gameName, userEmail: item.userEmail,
              topupInfo: item.topupInfo as Record<string, unknown>,
              topupLabels: item.topupLabels as Record<string, string>, topupFields: item.topupFields, paidAt,
            })),
          })),
        });
        return true;
      });

      if (settled) void flushTelegramNotifications();
      if (!payload.accountNumber || payload.accountNumber !== configuredAccount) {
        res.status(200).json({ success: true, ignored: true, reason: 'Mismatched account number' });
        return;
      }

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
