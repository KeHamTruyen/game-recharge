import { Router, Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeUpload } from '../utils/imageUpload.js';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';
import { auditAdminRequest } from '../middleware/requestContext.js';
import {
  getPagination,
  buildPaginatedResult,
  getPaginationSkipTake,
} from '../utils/pagination.js';
import { maskTopupInfo } from '../utils/crypto.js';
import { vndAmountSchema } from '../utils/money.js';

const router = Router();
const imageValueSchema = z.string().max(10_000_000).refine(
  (value) =>
    value.startsWith('data:image/') ||
    value.startsWith('/') ||
    z.string().url().safeParse(value).success,
  'Image must be a valid URL, local path, or image data URI',
);

// All admin routes require an authenticated administrator.
router.use(requireAuth, requireRole('ADMIN'), auditAdminRequest);

async function validatePackageTemplate(tx: Prisma.TransactionClient, templateId?: string): Promise<void> {
  if (!templateId) return;
  // Hold the template until package assignment commits; deletion takes an exclusive row lock.
  const templates = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM topup_templates WHERE id = ${templateId} FOR SHARE`;
  if (!templates.length) throw new AppError(`TopupTemplate '${templateId}' does not exist`, 400);
}

// ══════════════════════════════════════════════════════════════════════════════
// SERVICES CRUD
// ══════════════════════════════════════════════════════════════════════════════

const serviceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  game: z.string().min(1).max(100).trim(),
  category: z.string().max(30).trim().default('topup'),
  description: z.string().max(500).trim().default(''),
  iconText: z.string().max(10).trim().default(''),
  tone: z.string().max(30).trim().default('blue'),
  image: imageValueSchema.nullable().optional(),
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
  price: vndAmountSchema,
  oldPrice: vndAmountSchema.nullable().optional(),
  note: z.string().max(200).trim().default(''),
  tags: z.array(z.string().max(30)).default([]),
  statusId: z.string().min(1).default('available'),
  templateId: z.string().default(''),
  image: imageValueSchema.nullable().optional(),
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

      const statusExists = await prisma.productStatus.findUnique({
        where: { id: data.statusId },
      });
      if (!statusExists) {
        throw new AppError(`ProductStatus '${data.statusId}' does not exist`, 400);
      }
      const pkg = await prisma.$transaction(async (tx) => {
        await validatePackageTemplate(tx, data.templateId);
        return tx.servicePackage.create({ data });
      });
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

      if (data.statusId) {
        const statusExists = await prisma.productStatus.findUnique({
          where: { id: data.statusId },
        });
        if (!statusExists) {
          throw new AppError(`ProductStatus '${data.statusId}' does not exist`, 400);
        }
      }
      const pkg = await prisma.$transaction(async (tx) => {
        await validatePackageTemplate(tx, data.templateId);
        return tx.servicePackage.update({ where: { id }, data });
      });
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

router.put('/tags/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const { name } = z.object({ name: z.string().min(1).max(30).trim() }).parse(req.body);
    const existing = await prisma.catalogTag.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Tag not found', 404);
    }
    const updated = await prisma.catalogTag.update({
      where: { id },
      data: { name },
    });
    if (existing.name !== name) {
      const packages = await prisma.servicePackage.findMany({
        where: { tags: { has: existing.name } },
      });
      for (const pkg of packages) {
        const nextTags = Array.from(new Set(pkg.tags.map((t) => (t === existing.name ? name : t))));
        await prisma.servicePackage.update({
          where: { id: pkg.id },
          data: { tags: nextTags },
        });
      }
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/tags/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const existing = await prisma.catalogTag.findUnique({ where: { id } });
    if (existing) {
      const packages = await prisma.servicePackage.findMany({
        where: { tags: { has: existing.name } },
      });
      for (const pkg of packages) {
        const nextTags = pkg.tags.filter((t) => t !== existing.name);
        await prisma.servicePackage.update({
          where: { id: pkg.id },
          data: { tags: nextTags },
        });
      }
      await prisma.catalogTag.delete({ where: { id } });
    }
    res.json({ success: true, data: { message: 'Tag deleted' } });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// MEDIA & IMAGE GALLERY
// ══════════════════════════════════════════════════════════════════════════════

// POST /admin/upload
router.post(
  '/upload',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { filename, data } = z
        .object({
          filename: z.string().max(200).optional().default('image.png'),
          data: z.string().min(1).max(10_000_000),
        })
        .parse(req.body);

      const buffer = await normalizeUpload(data);
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const cleanBase = filename.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      const safeName = `${randomUUID()}_${cleanBase}.webp`;
      const filePath = path.join(uploadsDir, safeName);
      await fs.promises.writeFile(filePath, buffer);

      // In dev environment, sync with frontend public uploads if folder exists
      try {
        const frontendPublicUploads = path.join(process.cwd(), '..', 'frontend', 'public', 'uploads');
        if (fs.existsSync(path.dirname(frontendPublicUploads))) {
          if (!fs.existsSync(frontendPublicUploads)) {
            fs.mkdirSync(frontendPublicUploads, { recursive: true });
          }
          await fs.promises.writeFile(path.join(frontendPublicUploads, safeName), buffer);
        }
      } catch {
        // ignore sync error
      }

      const fileUrl = `/uploads/${safeName}`;
      res.json({ success: true, data: { url: fileUrl } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/media
router.get(
  '/media',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const files: string[] = [];
      if (fs.existsSync(uploadsDir)) {
        const dirFiles = fs
          .readdirSync(uploadsDir)
          .filter((f) => /\.(png|jpe?g|webp|svg|gif)$/i.test(f))
          .sort()
          .reverse();
        for (const f of dirFiles) {
          files.push(`/uploads/${f}`);
        }
      }
      res.json({ success: true, data: files });
    } catch (err) {
      next(err);
    }
  }
);

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
      const rawFallbackId = (req.query['fallbackId'] as string) || undefined;

      if (rawFallbackId && rawFallbackId === id) {
        throw new AppError('Trạng thái thay thế không được trùng với trạng thái đang xóa.', 400);
      }

      let fallback = rawFallbackId
        ? await prisma.productStatus.findFirst({ where: { id: rawFallbackId, NOT: { id } } })
        : null;

      if (rawFallbackId && !fallback) {
        throw new AppError('Trạng thái thay thế được chỉ định không tồn tại hoặc không hợp lệ.', 400);
      }

      if (!fallback) {
        fallback = await prisma.productStatus.findFirst({
          where: { id: { not: id } },
          orderBy: { id: 'asc' },
        });
      }

      const packageCount = await prisma.servicePackage.count({
        where: { statusId: id },
      });

      if (packageCount > 0 && !fallback) {
        throw new AppError(
          'Không thể xóa trạng thái này vì vẫn có gói sản phẩm đang sử dụng và không có trạng thái thay thế hợp lệ.',
          400
        );
      }

      await prisma.$transaction(async (tx) => {
        if (fallback) {
          await tx.servicePackage.updateMany({
            where: { statusId: id },
            data: { statusId: fallback.id },
          });
        }
        await tx.productStatus.delete({ where: { id } });
      });

      res.json({ success: true, data: { message: 'Status deleted', fallbackId: fallback?.id } });
    } catch (err) {
      next(err);
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// TOPUP TEMPLATES CRUD
// ══════════════════════════════════════════════════════════════════════════════

const templateFieldSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Mã trường (key) chỉ được chứa chữ cái, số, gạch ngang và gạch dưới'),
  label: z.string().min(1).max(150),
  type: z.string().min(1).max(50).default('text'),
  placeholder: z.string().max(200).optional().default(''),
  required: z.boolean().optional().default(true),
  hint: z.string().max(300).optional(),
  helpText: z.string().max(300).optional(),
  pattern: z.string().max(200).optional().refine((val) => {
    if (!val) return true;
    try {
      new RegExp(val);
      return true;
    } catch {
      return false;
    }
  }, { message: 'Biểu thức kiểm tra (pattern regex) không hợp lệ' }),
  options: z.array(z.union([
    z.string().max(150),
    z.object({
      value: z.string().max(150),
      label: z.string().max(150),
    }),
  ])).optional().default([]),
}).passthrough();

const templateFieldsListSchema = z.array(templateFieldSchema)
  .min(1, 'Mẫu nạp phải có ít nhất 1 trường thông tin')
  .max(20, 'Mẫu nạp không được vượt quá 20 trường thông tin')
  .refine((fields) => {
    const keys = fields.map((f) => f.key.toLowerCase());
    return new Set(keys).size === keys.length;
  }, { message: 'Không được có trường thông tin trùng mã (duplicate key)' });

const topupTemplateBodySchema = z.object({
  name: z.string().min(1).max(100),
  game: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  warning: z.string().max(500).default(''),
  fields: templateFieldsListSchema,
});

const topupTemplateSchema = topupTemplateBodySchema.extend({
  id: z.string().min(1).max(60),
});

const updateTopupTemplateSchema = topupTemplateBodySchema.partial();

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
      const data = updateTopupTemplateSchema.parse(req.body);
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
      await prisma.$transaction(async (tx) => {
        const templates = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM topup_templates WHERE id = ${id} FOR UPDATE`;
        if (!templates.length) throw new NotFoundError('Template');
        const usage = await tx.servicePackage.count({ where: { templateId: id } });
        if (usage) {
          throw new AppError(`Mẫu thông tin đang được ${usage} gói sử dụng. Hãy chuyển các gói sang mẫu khác trước khi xóa.`, 409);
        }
        await tx.topupTemplate.delete({ where: { id } });
      });
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
            paymentStatus: true,
            paymentOrderCode: true,
            qrCode: true,
            checkoutUrl: true,
            paidAt: true,
            refundAmount: true,
            refundTxId: true,
            refundReason: true,
            refundedById: true,
            refundedAt: true,
            topupInfo: true,
            topupFields: true,
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

      const maskedList = transactions.map((t) => ({
        ...t,
        topupInfo: maskTopupInfo(t.topupInfo, false, t.topupFields),
      }));

      res.json({
        success: true,
        data: buildPaginatedResult(maskedList, total, page, limit),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/transactions/:id - Get decrypted transaction details for fulfillment
router.get(
  '/transactions/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const transaction = await prisma.transaction.findFirst({
        where: { OR: [{ id }, { code: id }] },
        include: {
          service: { select: { id: true, name: true, iconText: true } },
          package: { select: { id: true, name: true, templateId: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });
      if (!transaction) throw new NotFoundError('Transaction');

      const canViewPassword = transaction.status === 'PENDING' || transaction.status === 'PROCESSING';

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

// PATCH /admin/transactions/:id/status
const updateTransactionStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PENDING', 'PAID', 'EXPIRED', 'FAILED', 'REFUNDED']).optional(),
  reason: z.string().max(500).optional().default('Điều chỉnh thủ công bởi quản trị viên'),
  refundAmount: z.coerce.number().positive().max(100_000_000).optional(),
  refundTxId: z.string().max(100).optional(),
  refundReason: z.string().max(500).optional(),
}).refine((data) => data.status !== undefined || data.paymentStatus !== undefined, {
  message: 'Cần cập nhật ít nhất trạng thái đơn hoặc trạng thái thanh toán',
});

router.patch(
  '/transactions/:id/status',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const body = updateTransactionStatusSchema.parse(req.body);

      const transaction = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${id} FOR UPDATE`;
        const previous = await tx.transaction.findUnique({
          where: { id },
          select: {
            id: true,
            code: true,
            status: true,
            paymentStatus: true,
            userId: true,
            amount: true,
            quantity: true,
          },
        });
        if (!previous) throw new NotFoundError('Transaction');

        const newStatus = body.status ?? previous.status;
        const newPaymentStatus = body.paymentStatus ?? previous.paymentStatus;
        const completedBefore = previous.status === 'COMPLETED';
        const completedAfter = newStatus === 'COMPLETED';

        if (previous.userId && completedBefore !== completedAfter) {
          const delta = completedAfter
            ? new Prisma.Decimal(previous.amount)
            : new Prisma.Decimal(previous.amount).neg();
          await tx.user.update({
            where: { id: previous.userId },
            data: { totalSpent: { increment: delta } },
          });
        }

        const updateData: Prisma.TransactionUpdateInput = {
          status: newStatus,
          paymentStatus: newPaymentStatus,
        };
        if (newPaymentStatus === 'PAID' && previous.paymentStatus !== 'PAID') {
          updateData.paidAt = new Date();
        }

        if (newStatus === 'REFUNDED' || newPaymentStatus === 'REFUNDED') {
          const refundAmt = body.refundAmount ? new Prisma.Decimal(body.refundAmount) : previous.amount;
          updateData.refundAmount = refundAmt;
          updateData.refundTxId = body.refundTxId || null;
          updateData.refundReason = body.refundReason || body.reason;
          updateData.refundedById = req.user?.email || req.user?.userId || 'admin';
          updateData.refundedAt = new Date();
        }

        const updated = await tx.transaction.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            code: true,
            status: true,
            paymentStatus: true,
            updatedAt: true,
            userEmail: true,
            packageName: true,
            gameName: true,
            amount: true,
            quantity: true,
            topupInfo: true,
            topupFields: true,
            topupLabels: true,
            templateName: true,
            createdAt: true,
            qrCode: true,
            checkoutUrl: true,
            paidAt: true,
            refundAmount: true,
            refundTxId: true,
            refundReason: true,
            refundedById: true,
            refundedAt: true,
          },
        });

        // Audit Log for status override with reason
        await tx.auditLog.create({
          data: {
            userId: req.user?.userId,
            action: newStatus === 'REFUNDED' ? 'TRANSACTION_REFUND' : 'TRANSACTION_STATUS_UPDATE',
            method: 'PATCH',
            path: req.path,
            statusCode: 200,
            ipAddress: req.ip || req.socket?.remoteAddress || null,
            requestId: req.requestId || null,
            metadata: {
              transactionId: id,
              transactionCode: previous.code,
              oldStatus: previous.status,
              newStatus,
              oldPaymentStatus: previous.paymentStatus,
              newPaymentStatus,
              reason: body.reason,
              updatedBy: req.user?.email,
              ...(newStatus === 'REFUNDED' || newPaymentStatus === 'REFUNDED'
                ? {
                    refundAmount: Number(updateData.refundAmount),
                    refundTxId: updateData.refundTxId,
                    refundReason: updateData.refundReason,
                    refundedById: updateData.refundedById,
                    refundedAt: updateData.refundedAt,
                  }
                : {}),
            },
          },
        });

        return updated;
      });

      res.json({ success: true, data: {
        ...transaction,
        topupInfo: maskTopupInfo(transaction.topupInfo, false, transaction.topupFields),
      } });
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

      if (
        id === req.user!.userId &&
        (data.status === 'BLOCKED' || (data.role && data.role !== 'ADMIN'))
      ) {
        throw new AppError('Bạn không thể tự khóa hoặc hạ quyền tài khoản của chính mình.', 400);
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          ...data,
          ...(data.status === 'BLOCKED' || data.role ? { tokenVersion: { increment: 1 } } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          totalSpent: true,
          createdAt: true,
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

const ALLOWED_SETTINGS = ['middlemanInfo', 'contactInfo', 'siteConfig', 'footerConfig'] as const;
type AllowedSetting = (typeof ALLOWED_SETTINGS)[number];

const contactChannelSchema = z.object({
  id: z.union([z.string(), z.number()]),
  platform: z.enum(['zalo', 'youtube', 'discord', 'facebook', 'telegram', 'email', 'custom']),
  label: z.string().max(100),
  name: z.string().max(120),
  description: z.string().max(500),
  url: z.string().max(500),
  image: imageValueSchema,
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
const footerCommunityGroupSchema = z.object({
  id: z.string().max(50),
  name: z.string().max(100),
  url: z.string().max(500),
});
const footerConfigSchema = z.object({
  showDonationBox: z.boolean().default(true),
  donationTitle: z.string().max(300),
  youtubeBtnText: z.string().max(100),
  youtubeUrl: z.string().max(500),
  donateBtnText: z.string().max(100),
  donateUrl: z.string().max(500),
  communityTitle: z.string().max(200),
  communityGroups: z.array(footerCommunityGroupSchema).max(30),
  copyrightText: z.string().max(300),
});
const settingSchemas = {
  middlemanInfo: middlemanInfoSchema,
  contactInfo: contactInfoSchema,
  siteConfig: z.record(z.string(), z.unknown()),
  footerConfig: footerConfigSchema,
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

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ══════════════════════════════════════════════════════════════════════════════

router.get(
  '/audit-logs',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = getPagination(req);
      const { skip, take } = getPaginationSkipTake(page, limit);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';

      const where: Prisma.AuditLogWhereInput = {};
      if (action) {
        where.action = { contains: action, mode: 'insensitive' };
      }
      if (search) {
        where.OR = [
          { path: { contains: search, mode: 'insensitive' } },
          { ipAddress: { contains: search } },
          { requestId: { contains: search } },
          { userId: { contains: search } },
        ];
      }

      const [total, items] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      res.json({
        success: true,
        data: buildPaginatedResult(items, total, page, limit),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT ANOMALIES (RECONCILIATION)
// ══════════════════════════════════════════════════════════════════════════════

// GET /admin/payment-anomalies
router.get(
  '/payment-anomalies',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
      const { skip, take } = getPaginationSkipTake(page, limit);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const anomalyType = typeof req.query.anomalyType === 'string' ? req.query.anomalyType.trim() : '';
      const resolved = typeof req.query.resolved === 'string' ? req.query.resolved === 'true' : undefined;

      const where: Prisma.PaymentAnomalyWhereInput = {
        ...(anomalyType ? { anomalyType } : {}),
        ...(resolved !== undefined ? { resolved } : {}),
        ...(search
          ? {
              OR: [
                { orderCode: { contains: search, mode: 'insensitive' } },
                { referenceCode: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [total, items] = await Promise.all([
        prisma.paymentAnomaly.count({ where }),
        prisma.paymentAnomaly.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      res.json({
        success: true,
        data: buildPaginatedResult(items, total, page, limit),
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/payment-anomalies/:id/resolve
router.patch(
  '/payment-anomalies/:id/resolve',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const { resolutionNote } = z
        .object({
          resolutionNote: z.string().trim().min(1).max(500),
        })
        .parse(req.body);

      const anomaly = await prisma.paymentAnomaly.update({
        where: { id },
        data: {
          resolved: true,
          resolvedBy: req.user?.email || 'admin',
          resolvedAt: new Date(),
          resolutionNote,
        },
      });

      res.json({ success: true, data: anomaly });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
