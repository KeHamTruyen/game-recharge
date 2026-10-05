import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  const startedAt = Date.now();
  res.on('finish', () => {
    console.info(JSON.stringify({
      event: 'http_request',
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    }));
  });
  next();
}

function sanitizeBody(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const sensitive = /password|token|secret|cookie|authorization|api.?key|uid|topupinfo/i;
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>)
      .filter(([key]) => !sensitive.test(key))
      .map(([key, value]) => [key, typeof value === 'string' && value.length > 120 ? `${value.slice(0, 120)}…` : value]),
  );
}

export function auditAdminRequest(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    void prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: `admin.${req.method.toLowerCase()}`,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        ipAddress: req.ip,
        requestId: req.requestId,
        metadata: JSON.parse(JSON.stringify({
          body: sanitizeBody(req.body),
          params: req.params,
          query: req.query,
        })),
      },
    }).catch((error: unknown) => {
      console.error(JSON.stringify({
        event: 'audit_log_failure',
        requestId: req.requestId,
        error: error instanceof Error ? error.message : 'unknown_error',
      }));
    });
  });
  next();
}
