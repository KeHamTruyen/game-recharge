import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

// ─── Custom Application Error ─────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403);
  }
}

// ─── Centralized Error Handler ────────────────────────────────────────────────

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const isProd = env.NODE_ENV === 'production';

  // Malformed JSON syntax error from body-parser
  if (
    (err instanceof SyntaxError && ('status' in err && (err as any).status === 400 || 'body' in err)) ||
    (err && typeof err === 'object' && (err as any).type === 'entity.parse.failed')
  ) {
    res.status(400).json({
      success: false,
      error: 'Cú pháp JSON không hợp lệ (Malformed JSON)',
      requestId: _req.requestId,
    });
    return;
  }

  // Request entity / body too large error
  if (
    (err && typeof err === 'object' && ((err as any).type === 'entity.too.large' || (err as any).status === 413)) ||
    (err instanceof Error && err.name === 'PayloadTooLargeError')
  ) {
    res.status(413).json({
      success: false,
      error: 'Dung lượng yêu cầu vượt quá giới hạn cho phép (Payload Too Large)',
      requestId: _req.requestId,
    });
    return;
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
      requestId: _req.requestId,
    });
    return;
  }

  // Operational/known errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      requestId: _req.requestId,
    });
    return;
  }

  // Prisma known errors
  if (err instanceof Error && err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as Error & { code?: string; meta?: { target?: string[] } };

    if (['P1000', 'P1001', 'P1002', 'P1008', 'P1017'].includes(prismaErr.code ?? '')) {
      res.status(503).json({
        success: false,
        error: 'Dịch vụ cơ sở dữ liệu tạm thời gián đoạn. Vui lòng thử lại sau ít phút.',
        requestId: _req.requestId,
      });
      return;
    }

    if (prismaErr.code === 'P2002') {
      const fields = prismaErr.meta?.target?.join(', ') ?? 'field';
      res.status(409).json({
        success: false,
        error: `A record with this ${fields} already exists`,
        requestId: _req.requestId,
      });
      return;
    }

    if (prismaErr.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Record not found',
        requestId: _req.requestId,
      });
      return;
    }
  }

  // Prisma connection & initialization errors
  if (
    err instanceof Error &&
    (err.constructor.name === 'PrismaClientInitializationError' ||
      err.name === 'PrismaClientInitializationError' ||
      err.constructor.name === 'PrismaClientRustPanicError' ||
      err.name === 'PrismaClientRustPanicError')
  ) {
    res.status(503).json({
      success: false,
      error: 'Dịch vụ cơ sở dữ liệu tạm thời gián đoạn. Vui lòng thử lại sau ít phút.',
      requestId: _req.requestId,
    });
    return;
  }

  // Unknown/unexpected errors
  if (!isProd) {
    // In development, expose the error details
    console.error(JSON.stringify({
      event: 'unhandled_error',
      requestId: _req.requestId,
      error: err instanceof Error ? err.message : 'unknown_error',
    }));
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
      requestId: _req.requestId,
    });
  } else {
    // In production, never expose internals
    console.error(JSON.stringify({
      event: 'unhandled_error',
      requestId: _req.requestId,
      error: 'internal_error',
    }));
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
      requestId: _req.requestId,
    });
  }
}

// ─── Not Found Handler ────────────────────────────────────────────────────────

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}
