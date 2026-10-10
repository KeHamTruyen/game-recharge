import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { getPagination, buildPaginatedResult, getPaginationSkipTake } from '../utils/pagination.js';

const router = Router();
const publicSettings = ['middlemanInfo', 'contactInfo', 'siteConfig', 'footerConfig'] as const;

// ─── Shared Selects ───────────────────────────────────────────────────────────

const packageSelect = {
  id: true,
  serviceId: true,
  name: true,
  description: true,
  price: true,
  oldPrice: true,
  note: true,
  tags: true,
  statusId: true,
  templateId: true,
  image: true,
  imagePosition: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─── GET /services ────────────────────────────────────────────────────────────

router.get(
  '/services',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const services = await prisma.service.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          game: true,
          category: true,
          description: true,
          iconText: true,
          tone: true,
          image: true,
          imagePosition: true,
          sortOrder: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { packages: { where: { isActive: true } } },
          },
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

// ─── GET /services/:id ────────────────────────────────────────────────────────

router.get(
  '/services/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

      const service = await prisma.service.findFirst({
        where: { id, isActive: true },
        select: {
          id: true,
          name: true,
          game: true,
          category: true,
          description: true,
          iconText: true,
          tone: true,
          image: true,
          imagePosition: true,
          sortOrder: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          packages: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: packageSelect,
          },
        },
      });

      if (!service) throw new NotFoundError('Service');

      res.json({ success: true, data: service });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /services/:id/packages ───────────────────────────────────────────────

router.get(
  '/services/:id/packages',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const { page, limit } = getPagination(req);
      const { skip, take } = getPaginationSkipTake(page, limit);

      // Ensure service exists
      const service = await prisma.service.findFirst({
        where: { id, isActive: true },
        select: { id: true },
      });
      if (!service) throw new NotFoundError('Service');

      const [packages, total] = await Promise.all([
        prisma.servicePackage.findMany({
          where: { serviceId: id, isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: packageSelect,
          skip,
          take,
        }),
        prisma.servicePackage.count({ where: { serviceId: id, isActive: true } }),
      ]);

      res.json({ success: true, data: buildPaginatedResult(packages, total, page, limit) });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/product-statuses',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const statuses = await prisma.productStatus.findMany({ orderBy: { id: 'asc' } });
      res.json({ success: true, data: statuses });
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

router.get(
  '/topup-templates',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const templates = await prisma.topupTemplate.findMany({ orderBy: { id: 'asc' } });
      res.json({ success: true, data: templates });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/settings/:key',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = req.params.id || req.params.key;
      if (!publicSettings.includes(key as (typeof publicSettings)[number])) {
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

// ─── GET /packages/:id ────────────────────────────────────────────────────────

router.get(
  '/packages/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

      const pkg = await prisma.servicePackage.findFirst({
        where: { id, isActive: true, service: { isActive: true } },
        select: {
          ...packageSelect,
          service: {
            select: {
              id: true,
              name: true,
              game: true,
              iconText: true,
              tone: true,
            },
          },
        },
      });

      if (!pkg) throw new NotFoundError('Package');

      res.json({ success: true, data: pkg });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
