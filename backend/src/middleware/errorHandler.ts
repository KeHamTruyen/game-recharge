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
    });
    return;
  }

  // Operational/known errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Prisma known errors
  if (err instanceof Error && err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as Error & { code?: string; meta?: { target?: string[] } };

    if (prismaErr.code === 'P2002') {
      const fields = prismaErr.meta?.target?.join(', ') ?? 'field';
      res.status(409).json({
        success: false,
        error: `A record with this ${fields} already exists`,
      });
      return;
    }

    if (prismaErr.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Record not found',
      });
      return;
    }
  }

  // Unknown/unexpected errors
  if (!isProd) {
    // In development, expose the error details
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
      stack: err instanceof Error ? err.stack : undefined,
    });
  } else {
    // In production, never expose internals
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.',
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
