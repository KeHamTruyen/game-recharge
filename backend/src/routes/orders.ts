import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';
import {
  getPagination,
  buildPaginatedResult,
  getPaginationSkipTake,
} from '../utils/pagination.js';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOrderCode(): string {
  const prefix = 'NX';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

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
  userEmail: z
    .string()
    .email('Valid email is required for guest orders')
    .optional(),
});

// ─── POST / — Create Order ────────────────────────────────────────────────────

router.post(
  '/',
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = createOrderSchema.parse(req.body);

      // Guest must provide email
      const effectiveEmail = req.user?.email ?? body.userEmail;
      if (!effectiveEmail) {
        throw new AppError('Email is required for guest orders', 400);
      }

      // Load package with service
      const pkg = await prisma.servicePackage.findFirst({
        where: { id: body.packageId, isActive: true },
        include: {
          service: { select: { id: true, name: true, game: true } },
        },
      });

      if (!pkg) throw new NotFoundError('Package');

      // Check status — purchasable
      const status = await prisma.productStatus.findUnique({
        where: { id: pkg.statusId },
        select: { purchasable: true, name: true },
      });

      if (!status?.purchasable) {
        throw new AppError(
          `This package is currently ${status?.name ?? 'unavailable'} and cannot be purchased`,
          400
        );
      }

      // Fetch template name if present
      let templateName = '';
      if (pkg.templateId) {
        const tpl = await prisma.topupTemplate.findUnique({
          where: { id: pkg.templateId },
          select: { name: true, fields: true },
        });
        templateName = tpl?.name ?? '';

        const fields = Array.isArray(tpl?.fields) ? tpl.fields as Array<Record<string, unknown>> : [];
        const allowedKeys = new Set(fields.map((field) => String(field.key || "")));
        for (const field of fields) {
          const key = String(field.key || "");
          const value = body.topupInfo[key];
          if (field.required && (value === undefined || String(value).trim() === "")) {
            throw new AppError(`Field ${String(field.label || key)} is required`, 400);
          }
          if (value !== undefined && field.type === "email" && !z.string().email().safeParse(String(value)).success) {
            throw new AppError(`Field ${String(field.label || key)} must be a valid email`, 400);
          }
          if (value !== undefined && field.type === "select" && Array.isArray(field.options) && !field.options.map(String).includes(String(value))) {
            throw new AppError(`Invalid option for ${String(field.label || key)}`, 400);
          }
        }
        for (const key of Object.keys(body.topupInfo)) {
          if (allowedKeys.size > 0 && !allowedKeys.has(key)) {
            throw new AppError(`Unknown top-up field: ${key}`, 400);
          }
        }
      }

      // Build topupLabels (human-readable field names → values)
      const topupLabels: Record<string, string> = {};
      for (const [key, val] of Object.entries(body.topupInfo)) {
        topupLabels[key] = String(val);
      }

      const amount = new Prisma.Decimal(pkg.price).mul(body.quantity);

      // Generate unique order code with retry
      let code = generateOrderCode();
      let attempts = 0;
      while (attempts < 5) {
        const exists = await prisma.transaction.findUnique({
          where: { code },
          select: { id: true },
        });
        if (!exists) break;
        code = generateOrderCode();
        attempts++;
      }

      const transaction = await prisma.transaction.create({
        data: {
          code,
          userId: req.user?.userId ?? null,
          userEmail: effectiveEmail,
          serviceId: pkg.service?.id ?? null,
          packageId: pkg.id,
          packageName: pkg.name,
          gameName: pkg.service?.game ?? '',
          amount,
          quantity: body.quantity,
          status: 'PENDING',
          topupInfo: body.topupInfo,
          topupLabels,
          templateName,
        },
        select: {
          id: true,
          code: true,
          userEmail: true,
          packageName: true,
          gameName: true,
          amount: true,
          quantity: true,
          status: true,
          topupInfo: true,
          topupLabels: true,
          templateName: true,
          createdAt: true,
          updatedAt: true,
          service: { select: { id: true, name: true, iconText: true, tone: true } },
          package: { select: { id: true, name: true, price: true } },
        },
      });

      res.status(201).json({ success: true, data: transaction });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /mine — My Orders ────────────────────────────────────────────────────

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
            packageName: true,
            gameName: true,
            amount: true,
            quantity: true,
            status: true,
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
          topupLabels: true,
          templateName: true,
          createdAt: true,
          updatedAt: true,
          service: { select: { id: true, name: true, iconText: true, tone: true } },
          package: { select: { id: true, name: true, price: true, description: true } },
        },
      });

      if (!transaction) throw new NotFoundError('Order');

      // Only allow: own orders or admin/staff
      const isOwner = transaction.userId === req.user!.userId;
      const isStaff = ['ADMIN', 'STAFF'].includes(req.user!.role);

      if (!isOwner && !isStaff) {
        throw new AppError('You do not have permission to view this order', 403);
      }

      res.json({ success: true, data: transaction });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
