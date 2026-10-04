import { Request } from 'express';
import { z } from 'zod';

// ─── Pagination Schema ────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

// ─── Pagination Result ────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getPagination(req: Request): PaginationParams {
  return paginationSchema.parse(req.query);
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function getPaginationSkipTake(
  page: number,
  limit: number
): { skip: number; take: number } {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}
