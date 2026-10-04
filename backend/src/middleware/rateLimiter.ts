import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// ─── Auth Rate Limiter ────────────────────────────────────────────────────────
// Strict: 10 requests per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
  skip: () => env.NODE_ENV === 'test',
});

// ─── API Rate Limiter ─────────────────────────────────────────────────────────
// General: 100 requests per minute per IP
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
  skip: () => env.NODE_ENV === 'test',
});

// ─── Admin Rate Limiter ───────────────────────────────────────────────────────
// Generous for admin panel operations
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many admin requests. Please slow down.',
  },
  skip: () => env.NODE_ENV === 'test',
});

// ─── Order Rate Limiter ───────────────────────────────────────────────────────
// Prevent order spam: 20 orders per 10 minutes per IP
export const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many orders placed. Please wait before placing another order.',
  },
  skip: () => env.NODE_ENV === 'test',
});
