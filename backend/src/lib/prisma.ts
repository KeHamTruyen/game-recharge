import { PrismaClient } from '@prisma/client';

// ─── Singleton Prisma Instance ────────────────────────────────────────────────
// Reuse a single connection pool in both dev (HMR) and production.

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  global.__prisma = prisma;
}
