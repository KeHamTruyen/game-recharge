import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { Role } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  tokenVersion?: number;
}

// Extend Express Request to carry the authenticated user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ─── Token Helpers ────────────────────────────────────────────────────────────

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRY as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.AUTH_COOKIE_SAMESITE,
    ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.AUTH_COOKIE_SAMESITE,
    ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
    path: '/',
  });
}

// ─── Middleware: Require Authentication ───────────────────────────────────────

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.auth_token as string | undefined;

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    clearAuthCookie(res);
    res.status(401).json({ success: false, error: 'Invalid or expired session' });
    return;
  }

  try {
    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, status: true, tokenVersion: true },
    });

    if (!user || user.status === 'BLOCKED') {
      clearAuthCookie(res);
      res.status(401).json({ success: false, error: 'Account is not active' });
      return;
    }

    if (user.tokenVersion !== (payload.tokenVersion ?? 0)) {
      clearAuthCookie(res);
      res.status(401).json({ success: false, error: 'Session expired' });
      return;
    }
    req.user = { userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion };
    next();
  } catch (error) {
    // Database connection or query error: DO NOT clear auth cookie, forward to centralized errorHandler
    next(error);
  }
}

// ─── Middleware: Optional Authentication ──────────────────────────────────────

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.auth_token as string | undefined;

  if (!token) {
    next();
    return;
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    next();
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, status: true, tokenVersion: true },
    });

    if (user && user.status === 'ACTIVE') {
      if (user.tokenVersion === (payload.tokenVersion ?? 0)) {
        req.user = { userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion };
      }
    }
  } catch {
    // Ignore DB errors during optionalAuth to avoid breaking public browsing
  }

  next();
}

// ─── Middleware: Require Role ─────────────────────────────────────────────────

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
