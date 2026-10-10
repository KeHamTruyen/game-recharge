import { Router } from 'express';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { auditAdminRequest } from '../middleware/requestContext.js';
import { wikiWriteLimiter } from '../middleware/rateLimiter.js';

const router = Router();
const idSchema = z.string().regex(/^[\w-]{1,100}$/);
const text = z.string().trim().min(1).max(200);
const image = z.string().max(1000).refine((v) => !v || /^https:\/\//.test(v) || /^\/(?!\/)/.test(v), 'Invalid image URL');
const skill = z.object({
  aniimo_id: z.number().int().positive(),
  s1_name: z.string().max(200).optional(), s1_icon: image.optional(),
  s2_name: z.string().max(200).optional(), s2_icon: image.optional(),
  s3_name: z.string().max(200).optional(), s3_icon: image.optional(),
  item_name: z.string().max(200).optional(), item_icon: image.optional(),
  item_id: z.string().max(100).optional(), item_quality: z.string().max(30).optional(),
});
const teamSchema = z.object({
  title: text, description: z.string().trim().max(3000),
  aniimo_ids: z.array(z.number().int().positive()).length(4),
  build_data: z.array(skill).length(4),
}).refine((v) => new Set(v.aniimo_ids).size === 4, 'Choose four different Aniimo')
  .refine((v) => v.build_data.every((slot, index) => slot.aniimo_id === v.aniimo_ids[index]), 'Build slots do not match the team');
const giftSchema = z.object({ code: text, reward: z.string().trim().min(1).max(1000), created_at: z.string().max(100).optional() });
const statsSchema = z.object({ hp: z.number(), atk: z.number(), break: z.number(), pdef: z.number(), mdef: z.number(), regen: z.number() });

// Cursor paging keeps the response bounded as the community grows.
router.get('/', async (req, res, next) => {
  try {
    const after = z.string().max(200).optional().parse(req.query.after);
    const entries = await prisma.wikiEntry.findMany({
      orderBy: { key: 'asc' }, take: 200,
      ...(after ? { where: { key: { gt: after } } } : {}),
    });
    res.json({ success: true, data: { entries, next: entries.length === 200 ? entries[199].key : null } });
  } catch (error) { next(error); }
});

router.use(requireAuth, wikiWriteLimiter);

router.post('/teams', async (req, res, next) => {
  try {
    const body = teamSchema.parse(req.body);
    const entry = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('wiki:teams'))`;
      const recent = await tx.wikiEntry.findFirst({ where: { kind: 'team', authorId: req.user!.userId }, orderBy: { createdAt: 'desc' } });
      if (recent && Date.now() - recent.createdAt.getTime() < 20_000) throw new AppError('Please wait 20 seconds before publishing another team', 429);
      const signature = [...body.aniimo_ids].sort((a, b) => a - b).join(',');
      const duplicate = await tx.wikiEntry.findFirst({ where: {
        kind: 'team', deleted: false,
        OR: [{ data: { path: ['signature'], equals: signature } }, { data: { path: ['normalizedTitle'], equals: body.title.toLowerCase() } }],
      } });
      if (duplicate) throw new AppError('Team or title already exists', 409);
      const author = await tx.user.findUniqueOrThrow({ where: { id: req.user!.userId }, select: { name: true } });
      const id = randomInt(1_000_000, 2 ** 48 - 1);
      return tx.wikiEntry.create({ data: {
        key: `team:${id}`, kind: 'team', authorId: req.user!.userId,
        data: { ...body, id, user_id: req.user!.userId, nickname: author.name, signature,
          normalizedTitle: body.title.toLowerCase(), isCommunity: true, avg_stars: 0, total_ratings: 0, time_ago: 'Vừa đăng' },
      } });
    });
    res.status(201).json({ success: true, data: entry });
  } catch (error) { next(error); }
});

router.put('/teams/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().safe().parse(req.params.id);
    const body = teamSchema.parse(req.body);
    const entry = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('wiki:teams'))`;
      const existing = await tx.wikiEntry.findUnique({ where: { key: `team:${id}` } });
      if (req.user!.role !== 'ADMIN' && (!existing || existing.authorId !== req.user!.userId)) throw new AppError('Forbidden', 403);
      if (existing?.deleted) throw new AppError('Team deleted', 404);
      const signature = [...body.aniimo_ids].sort((a, b) => a - b).join(',');
      const duplicate = await tx.wikiEntry.findFirst({ where: {
        kind: 'team', key: { not: `team:${id}` }, deleted: false,
        OR: [{ data: { path: ['signature'], equals: signature } }, { data: { path: ['normalizedTitle'], equals: body.title.toLowerCase() } }],
      } });
      if (duplicate) throw new AppError('Team or title already exists', 409);
      const data = { ...(existing?.data as Prisma.JsonObject || {}), ...body, id,
        signature, normalizedTitle: body.title.toLowerCase(), time_ago: 'Vừa cập nhật' };
      return tx.wikiEntry.upsert({ where: { key: `team:${id}` },
        create: { key: `team:${id}`, kind: 'team', data }, update: { data } });
    });
    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

router.delete('/teams/:id', async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().safe().parse(req.params.id);
    const entry = await prisma.wikiEntry.findUnique({ where: { key: `team:${id}` } });
    if (req.user!.role !== 'ADMIN' && (!entry || entry.authorId !== req.user!.userId)) throw new AppError('Forbidden', 403);
    await prisma.wikiEntry.upsert({ where: { key: `team:${id}` },
      create: { key: `team:${id}`, kind: 'team', deleted: true, data: { id } }, update: { deleted: true } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.post('/giftcodes', async (req, res, next) => {
  try {
    const body = giftSchema.parse(req.body);
    const code = body.code.toUpperCase();
    const entry = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`giftcode:${code}`}))`;
      if (await tx.wikiEntry.findFirst({ where: { kind: 'giftcode', deleted: false, data: { path: ['code'], equals: code } } })) throw new AppError('Giftcode already exists', 409);
      const author = await tx.user.findUniqueOrThrow({ where: { id: req.user!.userId }, select: { name: true } });
      const id = randomUUID();
      return tx.wikiEntry.create({ data: { key: `giftcode:${id}`, kind: 'giftcode', authorId: req.user!.userId,
        data: { ...body, id, code, author: author.name, created_at: new Date().toISOString(), isCommunity: req.user!.role !== 'ADMIN' } } });
    });
    res.status(201).json({ success: true, data: entry });
  } catch (error) { next(error); }
});

router.put('/giftcodes/:id', requireRole('ADMIN'), auditAdminRequest, async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    const body = giftSchema.parse(req.body);
    const key = `giftcode:${id}`;
    const entry = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const existing = await tx.wikiEntry.findUnique({ where: { key } });
      const data = { ...(existing?.data as Prisma.JsonObject || {}), ...body, id, code: body.code.toUpperCase() };
      return tx.wikiEntry.upsert({ where: { key },
        create: { key, kind: 'giftcode', data }, update: { data, deleted: false } });
    });
    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

router.delete('/giftcodes/:id', requireRole('ADMIN'), auditAdminRequest, async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    await prisma.wikiEntry.upsert({ where: { key: `giftcode:${id}` },
      create: { key: `giftcode:${id}`, kind: 'giftcode', data: { id }, deleted: true }, update: { deleted: true } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.post('/giftcodes/:id/vote', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    const { type } = z.object({ type: z.enum(['up', 'report']) }).parse(req.body);
    const key = `giftcode:${id}`;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const existing = await tx.wikiEntry.findUnique({ where: { key } });
      if (existing?.deleted) throw new AppError('Giftcode deleted', 404);
      await tx.wikiVote.upsert({ where: { entryKey_userId: { entryKey: key, userId: req.user!.userId } },
        create: { entryKey: key, userId: req.user!.userId, value: type }, update: { value: type } });
      const votes = await tx.wikiVote.groupBy({ by: ['value'], where: { entryKey: key }, _count: true });
      const data = { ...(existing?.data as Prisma.JsonObject || { id }),
        upvotes: votes.find((v) => v.value === 'up')?._count || 0,
        reports: votes.find((v) => v.value === 'report')?._count || 0 };
      await tx.wikiEntry.upsert({ where: { key }, create: { key, kind: 'giftcode', data }, update: { data } });
    });
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.put('/aniimos/:id', requireRole('ADMIN'), auditAdminRequest, async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const data = z.object({ title: text, stats: statsSchema,
      forms_and_maps: z.record(z.string().max(100), z.object({ form: z.string().max(300), map: z.string().max(1000) })).optional(),
    }).parse(req.body);
    const entry = await prisma.wikiEntry.upsert({ where: { key: `aniimo:${id}` },
      create: { key: `aniimo:${id}`, kind: 'aniimo', data }, update: { data } });
    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

router.post('/aniimos/:id/reviews', async (req, res, next) => {
  try {
    const monsterId = z.coerce.number().int().positive().parse(req.params.id);
    const body = z.object({ comment: z.string().trim().min(1).max(2000), rating: z.number().int().min(1).max(5) }).parse(req.body);
    const author = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId }, select: { name: true } });
    const id = randomUUID();
    const entry = await prisma.wikiEntry.create({ data: { key: `review:${id}`, kind: 'review', authorId: req.user!.userId,
      data: { ...body, id, monsterId, author: author.name, createdAt: new Date().toISOString() } } });
    res.status(201).json({ success: true, data: entry });
  } catch (error) { next(error); }
});

export default router;
