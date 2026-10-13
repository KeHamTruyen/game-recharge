import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';
import { vndAmountSchema } from '../utils/money.js';
import {
  getPagination,
  buildPaginatedResult,
  getPaginationSkipTake,
} from '../utils/pagination.js';
import {
  sanitizeTopupInfoForStorage,
  isSensitiveFieldKey,
  maskTopupInfo,
  maskCachedTopupInfo,
} from '../utils/crypto.js';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOrderCode(): string {
  return `DUKE${randomUUID().replaceAll('-', '').toUpperCase()}`;
}

const topupInfoSchema = z
  .record(
    z.string().min(1).max(50),
    z.union([z.string().max(500), z.number(), z.boolean()])
  )
  .refine((value) => Object.keys(value).length <= 20, {
    message: 'A maximum of 20 top-up fields is allowed',
  });

const createOrderSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
  topupInfo: topupInfoSchema.default({}),
});

const checkoutSchema = z.object({
  items: z.array(z.object({
    packageId: z.string().min(1, 'Package ID is required'),
    quantity: z.coerce.number().int().min(1).max(100),
  })).min(1).max(100),
  topupInfo: topupInfoSchema.default({}),
});

const transactionSelect = {
  id: true, code: true, userEmail: true, packageName: true, gameName: true,
  amount: true, quantity: true, status: true, topupInfo: true, topupFields: true,
  topupLabels: true, templateName: true, createdAt: true, updatedAt: true,
  service: { select: { id: true, name: true, iconText: true, tone: true } },
  package: { select: { id: true, name: true, price: true } },
  paymentStatus: true,
  paymentOrderCode: true,
  paymentLinkId: true,
  checkoutUrl: true,
  qrCode: true,
} satisfies Prisma.TransactionSelect;

type OrderInput = {
  packageId: string;
  quantity: number;
  topupInfo: Record<string, string | number | boolean>;
};

async function createOrder(
  tx: Prisma.TransactionClient,
  input: OrderInput,
  userId: string | null,
  userEmail: string,
) {
  const pkg = await tx.servicePackage.findFirst({
    where: { id: input.packageId, isActive: true, service: { isActive: true } },
    include: { service: { select: { id: true, name: true, game: true } } },
  });
  if (!pkg) throw new NotFoundError('Package');

  const price = vndAmountSchema.parse(pkg.price.toNumber());
  const amount = vndAmountSchema.parse(price * input.quantity);

  const status = await tx.productStatus.findUnique({
    where: { id: pkg.statusId },
    select: { purchasable: true, name: true },
  });
  if (!status?.purchasable) {
    throw new AppError(
      `This package is currently ${status?.name ?? 'unavailable'} and cannot be purchased`,
      400,
    );
  }

  let templateName = '';
  let templateFields: Array<Record<string, unknown>> = [];
  const labelMap = new Map<string, string>();
  if (pkg.templateId) {
    const template = await tx.topupTemplate.findUnique({
      where: { id: pkg.templateId },
      select: { name: true, fields: true },
    });
    if (!template) throw new AppError('Mẫu thông tin của gói không còn tồn tại. Vui lòng liên hệ hỗ trợ.', 400);
    templateName = template?.name ?? '';
    templateFields = Array.isArray(template?.fields)
      ? template.fields as Array<Record<string, unknown>>
      : [];
    const allowedKeys = new Set(templateFields.map((field) => String(field.key || '')));
    for (const field of templateFields) {
      const key = String(field.key || '');
      const value = input.topupInfo[key];
      if (field.required && (value === undefined || String(value).trim() === '')) {
        throw new AppError(`Field ${String(field.label || key)} is required`, 400);
      }
      if (value !== undefined && field.pattern) {
        let matches = false;
        try {
          matches = new RegExp(String(field.pattern)).test(String(value));
        } catch {
          throw new AppError(`Invalid validation pattern for ${String(field.label || key)}`, 500);
        }
        if (!matches) throw new AppError(`Invalid value for ${String(field.label || key)}`, 400);
      }
      if (value !== undefined && field.type === 'email' &&
        !z.string().email().safeParse(String(value)).success) {
        throw new AppError(`Field ${String(field.label || key)} must be a valid email`, 400);
      }
      if (value !== undefined && field.type === 'select' && Array.isArray(field.options)) {
        const options = field.options.map((option) =>
          option && typeof option === 'object' && 'value' in option
            ? String(option.value)
            : String(option),
        );
        if (!options.includes(String(value))) {
          throw new AppError(`Invalid option for ${String(field.label || key)}`, 400);
        }
      }
    }
    for (const field of templateFields) {
      if (field.key && field.label) {
        labelMap.set(String(field.key), String(field.label));
      }
    }
    for (const key of Object.keys(input.topupInfo)) {
      if (allowedKeys.size > 0 && !allowedKeys.has(key)) {
        throw new AppError(`Unknown top-up field: ${key}`, 400);
      }
    }
  }

  const fallbackFieldLabels: Record<string, string> = {
    uid: 'UID',
    server: 'Server',
    charactername: 'Tên nhân vật',
    character: 'Tên nhân vật',
    riotid: 'Riot ID',
    tagline: 'Tagline',
    region: 'Khu vực',
    zoneid: 'Zone ID',
    playerid: 'Player ID',
    roleid: 'Role ID',
    account: 'Tài khoản',
    email: 'Email liên hệ',
    phone: 'Số điện thoại',
    note: 'Ghi chú',
  };

  const topupLabels = Object.fromEntries(
    Object.keys(input.topupInfo).map((key) => {
      const label = labelMap.get(key) || fallbackFieldLabels[key.toLowerCase()] || key;
      return [key, label];
    }),
  );
  let code = generateOrderCode();
  for (let attempts = 0; attempts < 5; attempts += 1) {
    const exists = await tx.transaction.findUnique({ where: { code }, select: { id: true } });
    if (!exists) break;
    code = generateOrderCode();
  }

  const qrCode =
    env.SEPAY_BANK_CODE && env.SEPAY_ACCOUNT_NUMBER
      ? `https://qr.sepay.vn/img?${new URLSearchParams({
          acc: env.SEPAY_ACCOUNT_NUMBER,
          bank: env.SEPAY_BANK_CODE,
          amount: String(amount),
          des: code,
        })}`
      : null;

  return tx.transaction.create({
    data: {
      code, userId, userEmail, serviceId: pkg.service?.id ?? null,
      packageId: pkg.id, packageName: pkg.name, gameName: pkg.service?.game ?? '',
      amount,
      quantity: input.quantity, status: 'PENDING',
      paymentStatus: 'PENDING',
      paymentOrderCode: code,
      checkoutUrl: qrCode,
      qrCode,
      topupFields: Object.keys(input.topupInfo).map((key) => ({
        key, type: isSensitiveFieldKey(key, templateFields) ? 'password' : 'text',
      })),
      topupInfo: sanitizeTopupInfoForStorage(input.topupInfo, templateFields), topupLabels, templateName,
    },
    select: transactionSelect,
  });
}

async function checkOrderCreationAllowed(tx: Prisma.TransactionClient, userId: string, role?: string): Promise<void> {
  const siteConfig = await tx.setting.findUnique({ where: { id: 'siteConfig' } });
  const configVal = (siteConfig?.value || {}) as Record<string, unknown>;
  if (configVal.maintenanceMode === true && role !== 'ADMIN') {
    const msg = typeof configVal.maintenanceMessage === 'string' && configVal.maintenanceMessage.trim()
      ? configVal.maintenanceMessage.trim()
      : 'Hệ thống đang bảo trì nạp game định kỳ. Vui lòng quay lại sau ít phút!';
    throw new AppError(msg, 503);
  }

  const maxPending = Number(process.env.MAX_PENDING_ORDERS || 5);
  const pendingCount = await tx.transaction.count({
    where: {
      userId,
      status: 'PENDING',
      paymentStatus: { in: ['UNPAID', 'PENDING'] },
    },
  });
  if (pendingCount >= maxPending) {
    throw new AppError(
      `Bạn đang có ${pendingCount} đơn hàng chờ thanh toán. Vui lòng thanh toán hoặc hủy bớt đơn cũ trước khi tạo đơn mới.`,
      400
    );
  }
}

// ─── POST / — Create Order ────────────────────────────────────────────────────

// Both creation paths use the same price and template validation.
router.post('/', requireAuth, async (req, res, next): Promise<void> => {
  try {
    const body = createOrderSchema.parse(req.body);
    const transaction = await prisma.$transaction(async (tx) => {
      await checkOrderCreationAllowed(tx, req.user!.userId, req.user!.role);
      return createOrder(tx, body, req.user!.userId, req.user!.email);
    });
    const isStaffOrAdmin = req.user!.role === 'ADMIN';
    res.status(201).json({
      success: true,
      data: { ...transaction, topupInfo: maskTopupInfo(transaction.topupInfo, isStaffOrAdmin, transaction.topupFields) },
    });
  } catch (error) { next(error); }
});

// Recover a committed checkout without asking the browser to retain credentials.
router.get('/checkout', requireAuth, async (req, res, next): Promise<void> => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const rawKey = z.string().min(16).max(128).parse(req.header('Idempotency-Key'));
    const idempotencyKey = createHash('sha256').update(`${req.user!.userId}:${rawKey}`).digest('hex');
    const payment = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(('x' || substr(${idempotencyKey}, 1, 16))::bit(64)::bigint)`;
      const cached = await tx.checkoutRequest.findUnique({ where: { idempotencyKey } });
      if (!cached || cached.userId !== req.user!.userId) return null;
      return (cached.response as Prisma.JsonObject).payment;
    });
    res.json({ success: true, data: { payment } });
  } catch (error) { next(error); }
});

router.post('/checkout', requireAuth, async (req, res, next): Promise<void> => {
  try {
    const body = checkoutSchema.parse(req.body);
    const rawKey = z.string().min(16).max(128).parse(req.header('Idempotency-Key'));
    const userId = req.user!.userId;
    // Namespace keys by owner; legacy unscoped cached responses are never returned.
    const idempotencyKey = createHash('sha256').update(`${userId}:${rawKey}`).digest('hex');
    const payloadHash = createHash('sha256').update(JSON.stringify({
      items: body.items,
      topupInfo: Object.fromEntries(Object.entries(body.topupInfo).sort(([a], [b]) => a.localeCompare(b))),
    })).digest('hex');
    const response = await prisma.$transaction(async (tx) => {
      // 64-bit advisory lock using the first 16 hex chars (64 bits) of SHA-256 key prevents theoretical 32-bit collisions
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(('x' || substr(${idempotencyKey}, 1, 16))::bit(64)::bigint)`;
      const previous = await tx.checkoutRequest.findUnique({ where: { idempotencyKey } });
      if (previous) {
        if (previous.userId !== userId || previous.payloadHash !== payloadHash) {
          throw new AppError('Checkout key was already used for another request', 409);
        }
        const cached = JSON.parse(JSON.stringify(previous.response)) as Record<string, any>;
        if (cached && Array.isArray(cached.transactions)) {
          cached.transactions = cached.transactions.map((item: any) => ({
            ...item, topupInfo: maskCachedTopupInfo(item.topupInfo, item.topupFields),
          }));
        }
        return cached;
      }
      if (!env.SEPAY_BANK_CODE || !env.SEPAY_ACCOUNT_NUMBER || !env.SEPAY_ACCOUNT_NAME) {
        throw new AppError('Payment is not configured. Please contact support.', 503);
      }
      const packageIds = [...new Set(body.items.map((item) => item.packageId))];
      const packages = await tx.servicePackage.findMany({
        where: { id: { in: packageIds }, isActive: true, service: { isActive: true } },
        select: { id: true, templateId: true, serviceId: true },
      });
      if (packages.length !== packageIds.length ||
          new Set(packages.map((item) => item.templateId)).size > 1 ||
          new Set(packages.map((item) => item.serviceId)).size > 1) {
        throw new AppError('Cart items must belong to the same active game and top-up template', 400);
      }

      await checkOrderCreationAllowed(tx, userId, req.user!.role);

      const transactions = [];
      for (const item of body.items) {
        transactions.push(await createOrder(tx, { ...item, topupInfo: body.topupInfo }, userId, req.user!.email));
      }
      const paymentOrderCode = generateOrderCode();
      const amount = vndAmountSchema.parse(
        transactions.reduce((total, item) => total.add(item.amount), new Prisma.Decimal(0)).toNumber(),
      );
      const qrCode = `https://qr.sepay.vn/img?${new URLSearchParams({
        acc: env.SEPAY_ACCOUNT_NUMBER, bank: env.SEPAY_BANK_CODE,
        amount: String(amount), des: paymentOrderCode,
      })}`;
      const paymentFields = { paymentStatus: 'PENDING' as const, paymentOrderCode, checkoutUrl: qrCode, qrCode };
      await tx.transaction.updateMany({
        where: { id: { in: transactions.map((item) => item.id) } }, data: paymentFields,
      });
      const data = JSON.parse(JSON.stringify({
        transactions: transactions.map((item) => ({
          ...item,
          ...paymentFields,
          topupInfo: maskTopupInfo(item.topupInfo, false, item.topupFields),
        })),
        payment: {
          orderCode: paymentOrderCode, amount, checkoutUrl: qrCode, qrCode,
          bankCode: env.SEPAY_BANK_CODE, accountNumber: env.SEPAY_ACCOUNT_NUMBER,
          accountName: env.SEPAY_ACCOUNT_NAME, transferContent: paymentOrderCode,
        },
      })) as Prisma.InputJsonObject;
      await tx.checkoutRequest.create({ data: { idempotencyKey, userId, payloadHash, paymentOrderCode, response: data } });
      return data;
    }, { timeout: 15000 });
    res.status(201).json({ success: true, data: response });
  } catch (error) { next(error); }
});

router.get(
  '/mine',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = getPagination(req);
      const { skip, take } = getPaginationSkipTake(page, limit);

      const statusFilter = z
        .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'])
        .optional()
        .safeParse(req.query['status']);

      const whereClause: Prisma.TransactionWhereInput = {
        userId: req.user!.userId,
        ...(statusFilter.success && statusFilter.data
          ? { status: statusFilter.data }
          : {}),
      };

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          select: {
            id: true,
            code: true,
            userEmail: true,
            packageName: true,
            gameName: true,
            amount: true,
            quantity: true,
            status: true,
            paymentStatus: true,
            paymentOrderCode: true,
            qrCode: true,
            checkoutUrl: true,
            templateName: true,
            createdAt: true,
            updatedAt: true,
            service: { select: { id: true, name: true, iconText: true, tone: true } },
          },
        }),
        prisma.transaction.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: buildPaginatedResult(transactions, total, page, limit),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /:code — Order Detail ────────────────────────────────────────────────

router.get(
  '/:code',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code } = z.object({ code: z.string().min(1) }).parse(req.params);

      const transaction = await prisma.transaction.findUnique({
        where: { code },
        select: {
          id: true,
          code: true,
          userId: true,
          userEmail: true,
          packageName: true,
          gameName: true,
          amount: true,
          quantity: true,
          status: true,
          topupInfo: true,
          topupFields: true,
          topupLabels: true,
          templateName: true,
          createdAt: true,
          updatedAt: true,
          service: { select: { id: true, name: true, iconText: true, tone: true } },
          package: { select: { id: true, name: true, price: true, description: true } },
          paymentStatus: true,
          paymentOrderCode: true,
          qrCode: true,
          checkoutUrl: true,
        },
      });

      if (!transaction) throw new NotFoundError('Order');

      // Only allow the owner or an administrator.
      const isOwner = transaction.userId === req.user!.userId;
      const isStaffOrAdmin = req.user!.role === 'ADMIN';
      if (!isOwner && !isStaffOrAdmin) {
        throw new AppError('You do not have permission to view this order', 403);
      }

      // Passwords are only decrypted for staff/admin during fulfillment (PENDING or PROCESSING)
      const canViewPassword = isStaffOrAdmin && (transaction.status === 'PENDING' || transaction.status === 'PROCESSING');

      res.json({
        success: true,
        data: {
          ...transaction,
          topupInfo: maskTopupInfo(transaction.topupInfo, canViewPassword, transaction.topupFields),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /:code/payment — Resume Payment for Order ─────────────────────────────

router.get(
  '/:code/payment',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code } = z.object({ code: z.string().min(1) }).parse(req.params);

      const transaction = await prisma.transaction.findUnique({
        where: { code },
        select: {
          id: true,
          code: true,
          userId: true,
          amount: true,
          status: true,
          paymentStatus: true,
          paymentOrderCode: true,
          qrCode: true,
          checkoutUrl: true,
          packageName: true,
          gameName: true,
        },
      });

      if (!transaction) throw new NotFoundError('Order');

      const isOwner = transaction.userId === req.user!.userId;
      const isStaffOrAdmin = req.user!.role === 'ADMIN';
      if (!isOwner && !isStaffOrAdmin) {
        throw new AppError('You do not have permission to view this order', 403);
      }

      const des = transaction.paymentOrderCode || transaction.code;
      const amountNum = Number(transaction.amount);
      const bankCode = env.SEPAY_BANK_CODE || '';
      const accountNumber = env.SEPAY_ACCOUNT_NUMBER || '';
      const accountName = env.SEPAY_ACCOUNT_NAME || '';

      const qrCode =
        transaction.qrCode ||
        (bankCode && accountNumber
          ? `https://qr.sepay.vn/img?${new URLSearchParams({
              acc: accountNumber,
              bank: bankCode,
              amount: String(amountNum),
              des,
            })}`
          : '');

      res.json({
        success: true,
        data: {
          orderCode: transaction.code,
          paymentOrderCode: des,
          amount: amountNum,
          bankCode,
          accountNumber,
          accountName,
          transferContent: des,
          qrCode,
          status: transaction.status,
          paymentStatus: transaction.paymentStatus || 'PENDING',
          packageName: transaction.packageName,
          gameName: transaction.gameName,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /:code/cancel — Cancel Pending Order ────────────────────────────────

router.post(
  '/:code/cancel',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code } = z.object({ code: z.string().min(1) }).parse(req.params);
      const userId = req.user!.userId;
      const isAdmin = req.user!.role === 'ADMIN';

      const cancelled = await prisma.$transaction(async (tx) => {
        const order = await tx.transaction.findUnique({
          where: { code },
          select: { id: true, userId: true, status: true, paymentStatus: true, code: true },
        });

        if (!order) throw new NotFoundError('Order');

        if (order.userId !== userId && !isAdmin) {
          throw new AppError('Bạn không có quyền hủy đơn hàng này', 403);
        }

        if (order.status !== 'PENDING' || !['UNPAID', 'PENDING'].includes(order.paymentStatus)) {
          throw new AppError('Chỉ có thể hủy đơn hàng đang ở trạng thái chờ thanh toán', 400);
        }

        return tx.transaction.update({
          where: { id: order.id },
          data: {
            status: 'FAILED',
            paymentStatus: 'EXPIRED',
            paymentMetadata: {
              cancelledBy: isAdmin ? 'ADMIN' : 'CUSTOMER',
              cancelledAt: new Date().toISOString(),
            },
          },
          select: transactionSelect,
        });
      });

      res.json({
        success: true,
        data: {
          ...cancelled,
          topupInfo: maskTopupInfo(cancelled.topupInfo, isAdmin, cancelled.topupFields),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
