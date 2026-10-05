import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { auditAdminRequest } from '../middleware/requestContext.js';
import {
  getPagination,
  buildPaginatedResult,
  getPaginationSkipTake,
} from '../utils/pagination.js';

const router = Router();

// All admin routes require an authenticated administrator.
router.use(requireAuth, requireRole('ADMIN'), auditAdminRequest);

// ══════════════════════════════════════════════════════════════════════════════
// SERVICES CRUD
// ══════════════════════════════════════════════════════════════════════════════

const serviceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  game: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().default(''),
  iconText: z.string().max(10).trim().default(''),
  tone: z.string().max(30).trim().default('blue'),
  image: z.string().url().nullable().optional(),
  imagePosition: z.string().regex(/^\d{1,3}%\s+\d{1,3}%$/).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

// GET /admin/services
router.get(
  '/services',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const services = await prisma.service.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: { select: { packages: true } },
        },
      });

      const data = services.map((s) => ({
        ...s,
        packageCount: s._count.packages,
        _count: undefined,
      }));

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/services
router.post(
  '/services',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = serviceSchema.parse(req.body);
      const service = await prisma.service.create({ data });
      res.status(201).json({ success: true, data: service });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /admin/services/:id
router.put(
  '/services/:id',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const data = serviceSchema.partial().parse(req.body);

      const service = await prisma.service.update({ where: { id }, data });
      res.json({ success: true, data: service });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /admin/services/:id
router.delete(
  '/services/:id',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      await prisma.service.delete({ where: { id } });
      res.json({ success: true, data: { message: 'Service deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PACKAGES CRUD
// ══════════════════════════════════════════════════════════════════════════════

const packageSchema = z.object({
  serviceId: z.string().min(1),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().default(''),
  price: z.coerce.number().positive(),
  oldPrice: z.coerce.number().positive().nullable().optional(),
  note: z.string().max(200).trim().default(''),
  tags: z.array(z.string().max(30)).default([]),
  statusId: z.string().min(1).default('available'),
  templateId: z.string().default(''),
  image: z.string().url().nullable().optional(),
  imagePosition: z.string().regex(/^\d{1,3}%\s+\d{1,3}%$/).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

// GET /admin/packages
router.get(
  '/packages',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = getPagination(req);
      const { skip, take } = getPaginationSkipTake(page, limit);

      const serviceId = z.string().optional().parse(req.query['serviceId']);

      const where: Prisma.ServicePackageWhereInput = serviceId
        ? { serviceId }
        : {};

      const [packages, total] = await Promise.all([
        prisma.servicePackage.findMany({
          where,
          orderBy: [{ serviceId: 'asc' }, { sortOrder: 'asc' }],
          skip,
          take,
          include: {
            service: { select: { id: true, name: true, game: true } },
          },
        }),
        prisma.servicePackage.count({ where }),
      ]);

      res.json({
        success: true,
        data: buildPaginatedResult(packages, total, page, limit),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/packages
router.post(
  '/packages',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = packageSchema.parse(req.body);
      const pkg = await prisma.servicePackage.create({ data });
      res.status(201).json({ success: true, data: pkg });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /admin/packages/:id
router.put(
  '/packages/:id',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const data = packageSchema.partial().omit({ serviceId: true }).parse(req.body);

      const pkg = await prisma.servicePackage.update({ where: { id }, data });
      res.json({ success: true, data: pkg });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /admin/packages/:id
router.delete(
  '/packages/:id',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      await prisma.servicePackage.delete({ where: { id } });
      res.json({ success: true, data: { message: 'Package deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/tags', async (_req, res, next) => {
  try {
    const tags = await prisma.catalogTag.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: tags });
  } catch (err) {
    next(err);
  }
});

router.post('/tags', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = z.object({ name: z.string().min(1).max(30).trim() }).parse(req.body);
    const tag = await prisma.catalogTag.create({ data });
    res.status(201).json({ success: true, data: tag });
  } catch (err) {
    next(err);
  }
});

router.delete('/tags/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    await prisma.catalogTag.delete({ where: { id } });
    res.json({ success: true, data: { message: 'Tag deleted' } });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCT STATUSES CRUD
// ══════════════════════════════════════════════════════════════════════════════

const productStatusSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(60),
  iconName: z.string().max(50).default('circle'),
  color: z.string().max(30).default('gray'),
  purchasable: z.boolean().default(true),
});

router.get(
  '/product-statuses',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const statuses = await prisma.productStatus.findMany({
        orderBy: { id: 'asc' },
      });
      res.json({ success: true, data: statuses });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/product-statuses',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = productStatusSchema.parse(req.body);
      const status = await prisma.productStatus.create({ data });
      res.status(201).json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/product-statuses/:id',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const data = productStatusSchema.partial().omit({ id: true }).parse(req.body);
      const status = await prisma.productStatus.update({ where: { id }, data });
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/product-statuses/:id',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      await prisma.productStatus.delete({ where: { id } });
      res.json({ success: true, data: { message: 'Status deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// TOPUP TEMPLATES CRUD
// ══════════════════════════════════════════════════════════════════════════════

const topupTemplateSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(100),
  game: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  warning: z.string().max(300).default(''),
  fields: z.array(z.record(z.string(), z.unknown())).or(z.record(z.string(), z.unknown())),
});

router.get(
  '/topup-templates',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const templates = await prisma.topupTemplate.findMany({
        orderBy: { id: 'asc' },
      });
      res.json({ success: true, data: templates });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/topup-templates/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const tpl = await prisma.topupTemplate.findUnique({ where: { id } });
      if (!tpl) throw new NotFoundError('Template');
      res.json({ success: true, data: tpl });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/topup-templates',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = topupTemplateSchema.parse(req.body);
      const tpl = await prisma.topupTemplate.create({
        data: { ...data, fields: data.fields as Prisma.InputJsonValue },
      });
      res.status(201).json({ success: true, data: tpl });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/topup-templates/:id',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const data = topupTemplateSchema.partial().omit({ id: true }).parse(req.body);
      const { fields, ...metadata } = data;
      const tpl = await prisma.topupTemplate.update({
        where: { id },
        data: {
          ...metadata,
          ...(fields !== undefined
            ? { fields: fields as Prisma.InputJsonValue }
            : {}),
        },
      });
      res.json({ success: true, data: tpl });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/topup-templates/:id',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      await prisma.topupTemplate.delete({ where: { id } });
      res.json({ success: true, data: { message: 'Template deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/transactions
router.get(
  '/transactions',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = getPagination(req);
      const { skip, take } = getPaginationSkipTake(page, limit);

      const querySchema = z.object({
        status: z
          .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'])
          .optional(),
        search: z.string().max(100).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        gameId: z.string().optional(),
      });

      const q = querySchema.parse(req.query);

      const where: Prisma.TransactionWhereInput = {
        ...(q.status ? { status: q.status } : {}),
        ...(q.gameId ? { serviceId: q.gameId } : {}),
        ...(q.search
          ? {
              OR: [
                { code: { contains: q.search, mode: 'insensitive' } },
                { userEmail: { contains: q.search, mode: 'insensitive' } },
                { packageName: { contains: q.search, mode: 'insensitive' } },
                { gameName: { contains: q.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(q.from || q.to
          ? {
              createdAt: {
                ...(q.from ? { gte: new Date(q.from) } : {}),
                ...(q.to ? { lte: new Date(q.to) } : {}),
              },
            }
          : {}),
      };

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
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
            service: { select: { id: true, name: true, iconText: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.transaction.count({ where }),
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

// PATCH /admin/transactions/:id/status
router.patch(
  '/transactions/:id/status',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const { status } = z
        .object({
          status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED']),
        })
        .parse(req.body);

      const transaction = await prisma.$transaction(async (tx) => {
        const previous = await tx.transaction.findUnique({
          where: { id },
          select: { status: true, userId: true, amount: true, quantity: true },
        });
        if (!previous) throw new NotFoundError('Transaction');
        const completedBefore = previous.status === 'COMPLETED';
        const completedAfter = status === 'COMPLETED';
        if (previous.userId && completedBefore !== completedAfter) {
          const delta = completedAfter
            ? new Prisma.Decimal(previous.amount)
            : new Prisma.Decimal(previous.amount).neg();
          await tx.user.update({
            where: { id: previous.userId },
            data: { totalSpent: { increment: delta } },
          });
        }
        return tx.transaction.update({
          where: { id },
          data: { status },
        select: {
          id: true,
          code: true,
          status: true,
          updatedAt: true,
          userEmail: true,
          packageName: true,
          gameName: true,
          amount: true,
          quantity: true,
          topupInfo: true,
          topupLabels: true,
          templateName: true,
          createdAt: true,
        },
        });
      });

      res.json({ success: true, data: transaction });
    } catch (err) {
      next(err);
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// USERS MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/users
router.get(
  '/users',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = getPagination(req);
      const { skip, take } = getPaginationSkipTake(page, limit);

      const querySchema = z.object({
        search: z.string().max(100).optional(),
        role: z.enum(['CUSTOMER', 'ADMIN']).optional(),
        status: z.enum(['ACTIVE', 'BLOCKED']).optional(),
      });

      const q = querySchema.parse(req.query);

      const where: Prisma.UserWhereInput = {
        ...(q.role ? { role: q.role } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.search
          ? {
              OR: [
                { email: { contains: q.search, mode: 'insensitive' } },
                { name: { contains: q.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            totalSpent: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { transactions: true } },
          },
        }),
        prisma.user.count({ where }),
      ]);

      const data = users.map((u) => ({
        ...u,
        transactionCount: u._count.transactions,
        _count: undefined,
      }));

      res.json({
        success: true,
        data: buildPaginatedResult(data, total, page, limit),
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/users/:id
router.patch(
  '/users/:id',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

      const updateSchema = z.object({
        role: z.enum(['CUSTOMER', 'ADMIN']).optional(),
        status: z.enum(['ACTIVE', 'BLOCKED']).optional(),
        name: z.string().min(2).max(60).trim().optional(),
      });

      const data = updateSchema.parse(req.body);

      if (Object.keys(data).length === 0) {
        res.status(400).json({ success: false, error: 'No valid fields to update' });
        return;
      }

      const user = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          totalSpent: true,
          updatedAt: true,
        },
      });

      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════════

const ALLOWED_SETTINGS = ['middlemanInfo', 'contactInfo', 'siteConfig'] as const;
type AllowedSetting = (typeof ALLOWED_SETTINGS)[number];

const contactChannelSchema = z.object({
  id: z.union([z.string(), z.number()]),
  platform: z.enum(['zalo', 'youtube', 'discord', 'facebook', 'telegram', 'email', 'custom']),
  label: z.string().max(100),
  name: z.string().max(120),
  description: z.string().max(500),
  url: z.string().max(500),
  image: z.string().max(500),
  color: z.string().max(30),
});
const contactInfoSchema = z.object({
  intro: z.string().max(2000),
  supportHours: z.string().max(100),
  commitmentTitle: z.string().max(200),
  commitment: z.string().max(2000),
  channels: z.array(contactChannelSchema).max(20),
});
const middlemanInfoSchema = z.object({
  intro: z.string().max(2000),
  supportHours: z.string().max(100),
  contactTitle: z.string().max(200),
  contactDescription: z.string().max(1000),
  zaloName: z.string().max(120),
  zaloPhone: z.string().max(50),
  zaloUrl: z.string().max(500),
  fees: z.array(z.object({ range: z.string().max(100), fee: z.string().max(100) })).max(20),
  feeNote: z.string().max(1000),
  accepted: z.string().max(2000),
  rejected: z.string().max(2000),
  warning: z.string().max(2000),
  bank: z.string().max(100),
  accountNumber: z.string().max(100),
  accountHolder: z.string().max(200),
  commitment: z.string().max(2000),
});
const settingSchemas = {
  middlemanInfo: middlemanInfoSchema,
  contactInfo: contactInfoSchema,
  siteConfig: z.record(z.string(), z.unknown()),
} as const;

function isAllowedSetting(key: string): key is AllowedSetting {
  return ALLOWED_SETTINGS.includes(key as AllowedSetting);
}

// GET /admin/settings/:key
router.get(
  '/settings/:key',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { key } = z.object({ key: z.string().min(1) }).parse(req.params);

      if (!isAllowedSetting(key)) {
        throw new NotFoundError('Setting');
      }

      const setting = await prisma.setting.findUnique({ where: { id: key } });
      if (!setting) throw new NotFoundError('Setting');

      res.json({ success: true, data: setting });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /admin/settings/:key
router.put(
  '/settings/:key',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { key } = z.object({ key: z.string().min(1) }).parse(req.params);

      if (!isAllowedSetting(key)) {
        throw new NotFoundError('Setting');
      }

      const value = settingSchemas[key].parse(req.body) as Prisma.InputJsonObject;

      const setting = await prisma.setting.upsert({
        where: { id: key },
        update: { value },
        create: { id: key, value },
      });

      res.json({ success: true, data: setting });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
