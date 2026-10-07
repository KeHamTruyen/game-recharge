import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
} from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendVerificationCode } from '../utils/email.js';
import { authLimiter } from '../middleware/rateLimiter.js';

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
    .max(72, 'Password must not exceed 72 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
  scope: z.enum(['storefront', 'admin']).optional(),
});
const codeSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
});
const resetSchema = codeSchema.extend({
  password: registerSchema.shape.password,
});
const profileSchema = z.object({
  name: registerSchema.shape.name,
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: registerSchema.shape.password,
});

function createCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function createEmailVerification(data: {
  email: string;
  purpose: 'register' | 'reset';
  name?: string;
  passwordHash?: string;
}): Promise<void> {
  const code = createCode();
  await prisma.emailVerification.deleteMany({ where: { email: data.email, purpose: data.purpose } });
  await prisma.emailVerification.create({
    data: {
      ...data,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  await sendVerificationCode(data.email, code, data.purpose);
}

async function consumeCode(email: string, purpose: string, code: string) {
  const verification = await prisma.emailVerification.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!verification || verification.expiresAt < new Date() || verification.attempts >= 5) {
    throw new AppError('Mã xác minh không hợp lệ hoặc đã hết hạn.', 400);
  }
  const matches = crypto.timingSafeEqual(
    Buffer.from(verification.codeHash, 'hex'),
    Buffer.from(hashCode(code), 'hex'),
  );
  if (!matches) {
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError('Mã xác minh không đúng.', 400);
  }
  await prisma.emailVerification.update({ where: { id: verification.id }, data: { consumedAt: new Date() } });
  return verification;
}

// ─── POST /register ───────────────────────────────────────────────────────────

router.post(
  '/register',
  authLimiter,
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
      await createEmailVerification({ email, name, passwordHash, purpose: 'register' });
      res.status(202).json({ success: true, data: { requiresVerification: true } });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/register/verify', authLimiter, async (req, res, next): Promise<void> => {
  try {
    const { email, code } = codeSchema.parse(req.body);
    const verification = await consumeCode(email, 'register', code);
    if (!verification.name || !verification.passwordHash) throw new AppError('Yêu cầu đăng ký không hợp lệ.', 400);
    const user = await prisma.user.create({
      data: { name: verification.name, email, passwordHash: verification.passwordHash, role: 'CUSTOMER', status: 'ACTIVE' },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
    setAuthCookie(res, signToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: 0 }));
    res.status(201).json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

router.post('/forgot-password', authLimiter, async (req, res, next): Promise<void> => {
  try {
    const { email } = z.object({ email: z.string().email().toLowerCase().trim() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await createEmailVerification({ email, purpose: 'reset' });
    res.json({ success: true, data: { message: 'Nếu email tồn tại, mã xác minh đã được gửi.' } });
  } catch (err) { next(err); }
});

router.post('/reset-password', authLimiter, async (req, res, next): Promise<void> => {
  try {
    const { email, code, password } = resetSchema.parse(req.body);
    await consumeCode(email, 'reset', code);
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        tokenVersion: { increment: 1 },
      },
    });
    res.json({ success: true, data: { message: 'Đặt lại mật khẩu thành công.' } });
  } catch (err) { next(err); }
});

// ─── POST /login ──────────────────────────────────────────────────────────────

router.post(
  '/login',
  authLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, scope } = loginSchema.parse(req.body);

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
          tokenVersion: true,
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

      if (scope === 'storefront' && user.role === 'ADMIN') {
        throw new AppError(
          'Tài khoản quản trị viên không thể đăng nhập tại đây. Vui lòng truy cập trang quản trị riêng (/admin).',
          403
        );
      }

      if (scope === 'admin' && user.role !== 'ADMIN') {
        throw new AppError('Tài khoản không có quyền quản trị.', 403);
      }

      const token = signToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion });
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

router.put('/profile', requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { name } = profileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { name },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

router.post('/change-password', requireAuth, async (req, res, next): Promise<void> => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { passwordHash: true, tokenVersion: true },
    });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError('Mật khẩu hiện tại không đúng.', 400);
    }
    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 12), tokenVersion: { increment: 1 } },
      select: { id: true, email: true, name: true, role: true, status: true, tokenVersion: true },
    });
    setAuthCookie(res, signToken({
      userId: updated.id,
      email: updated.email,
      role: updated.role,
      tokenVersion: updated.tokenVersion,
    }));
    res.json({ success: true, data: { message: 'Đổi mật khẩu thành công.' } });
  } catch (err) { next(err); }
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
