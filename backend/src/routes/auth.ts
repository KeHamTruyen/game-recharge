import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
} from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(60, 'Name must not exceed 60 characters')
    .trim(),
  email: z
    .string()
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(72, 'Password must not exceed 72 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

// ─── POST /register ───────────────────────────────────────────────────────────

router.post(
  '/register',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, password } = registerSchema.parse(req.body);

      // Check for existing user
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existing) {
        throw new AppError('An account with this email already exists', 409);
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: { name, email, passwordHash, role: 'CUSTOMER', status: 'ACTIVE' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          totalSpent: true,
        },
      });

      const token = signToken({ userId: user.id, email: user.email, role: user.role });
      setAuthCookie(res, token);

      res.status(201).json({
        success: true,
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /login ──────────────────────────────────────────────────────────────

router.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          passwordHash: true,
          createdAt: true,
          totalSpent: true,
        },
      });

      // Use constant-time comparison to prevent timing attacks
      const dummyHash =
        '$2b$12$invalidhashfortimingattackpreventionXXXXXXXXXXXXXXXXXXXXX';
      const isValid = await bcrypt.compare(
        password,
        user?.passwordHash ?? dummyHash
      );

      if (!user || !isValid) {
        throw new AppError('Invalid email or password', 401);
      }

      if (user.status === 'BLOCKED') {
        throw new AppError(
          'Your account has been suspended. Please contact support.',
          403
        );
      }

      const token = signToken({ userId: user.id, email: user.email, role: user.role });
      setAuthCookie(res, token);

      const { passwordHash: _pw, ...safeUser } = user;
      void _pw; // discard

      res.json({
        success: true,
        data: { user: safeUser },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /logout ─────────────────────────────────────────────────────────────

router.post('/logout', (_req: Request, res: Response): void => {
  clearAuthCookie(res);
  res.json({ success: true, data: { message: 'Logged out successfully' } });
});

// ─── GET /session ─────────────────────────────────────────────────────────────

router.get(
  '/session',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          totalSpent: true,
        },
      });

      if (!user) {
        clearAuthCookie(res);
        throw new AppError('User not found', 404);
      }

      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
