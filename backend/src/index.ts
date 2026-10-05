// Load env validation before anything else
import './config/env.js';
import { env } from './config/env.js';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { authLimiter, apiLimiter, adminLimiter, orderLimiter, paymentStatusLimiter, paymentWebhookLimiter } from './middleware/rateLimiter.js';
import { requestContext } from './middleware/requestContext.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { prisma } from './lib/prisma.js';

import authRouter from './routes/auth.js';
import catalogRouter from './routes/catalog.js';
import ordersRouter from './routes/orders.js';
import adminRouter from './routes/admin.js';
import paymentsRouter from './routes/payments.js';

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────

const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: origin ${origin} is not allowed`));
      }
    },
    credentials: true, // Required for cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-Request-Id'],
    maxAge: 86400, // 24h preflight cache
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser(env.COOKIE_SECRET));

// ─── Trust Proxy ─────────────────────────────────────────────────────────────
// Required for rate-limiting behind nginx/load balancer
app.set('trust proxy', 1);
app.use(requestContext);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] ?? '1.0.0',
      environment: env.NODE_ENV,
    },
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

// Auth routes — strict rate limiting
app.use('/api/auth', authLimiter, authRouter);

// Catalog — public browsing, general API limit
app.use('/api/catalog', apiLimiter, catalogRouter);

// Orders — custom order limiter
app.use('/api/orders', orderLimiter, ordersRouter);

// Admin — generous limit for back-office operations
app.use('/api/admin', adminLimiter, adminRouter);
app.use('/api/payments/status', paymentStatusLimiter);
app.use('/api/payments/webhook', paymentWebhookLimiter);
app.use('/api/payments', paymentsRouter);

// ─── Not Found + Error Handler ────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────

async function startServer(): Promise<void> {
  try {
    // Test DB connection
    await prisma.$connect();
    console.log('✅ Database connected');

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 NEXA TOPUP API running on http://localhost:${env.PORT}`);
      console.log(`   Environment: ${env.NODE_ENV}`);
      console.log(`   CORS allowed: ${allowedOrigins.join(', ')}`);
    });

    const staleOrderCheck = setInterval(() => {
      const expirationCutoff = new Date(Date.now() - 15 * 60 * 1000);
      void prisma.transaction.updateMany({
        where: {
          status: 'PENDING',
          paymentStatus: { in: ['UNPAID', 'PENDING'] },
          updatedAt: { lt: expirationCutoff },
        },
        data: { paymentStatus: 'EXPIRED' },
      }).then((result) => {
        if (result.count > 0) {
          console.warn(JSON.stringify({
            event: 'stale_orders_expired',
            count: result.count,
            thresholdMinutes: 15,
          }));
        }
      }).catch((error: unknown) => {
        console.error(JSON.stringify({
          event: 'stale_order_expiration_failure',
          error: error instanceof Error ? error.message : 'unknown_error',
        }));
      });
      void prisma.transaction.count({
        where: {
          status: 'PROCESSING',
          updatedAt: { lt: expirationCutoff },
        },
      }).then((count) => {
        if (count > 0) {
          console.warn(JSON.stringify({
            event: 'stale_orders_detected',
            count,
            thresholdMinutes: 15,
          }));
        }
      }).catch((error: unknown) => {
        console.error(JSON.stringify({
          event: 'stale_order_check_failure',
          error: error instanceof Error ? error.message : 'unknown_error',
        }));
      });
    }, 5 * 60 * 1000);

    // ─── Graceful Shutdown ─────────────────────────────────────────────────
    const shutdown = async (signal: string): Promise<void> => {
      console.log(`\n⚠️  Received ${signal}. Shutting down gracefully...`);

      server.close(async () => {
        clearInterval(staleOrderCheck);
        console.log('🔌 HTTP server closed');
        await prisma.$disconnect();
        console.log('🔌 Database disconnected');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

void startServer();

export default app;
