import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRY: z.string().default('7d'),

  // Server
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // CORS — comma-separated origins
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Cookie signing secret
  COOKIE_SECRET: z
    .string()
    .min(32, 'COOKIE_SECRET must be at least 32 characters long'),
  AUTH_COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  // Data encryption key (separate from JWT)
  DATA_ENCRYPTION_KEY: z.string().min(16).optional(),

  SEPAY_API_KEY: z.string().optional(),
  SEPAY_BANK_CODE: z.string().optional(),
  SEPAY_ACCOUNT_NUMBER: z.string().optional(),
  SEPAY_ACCOUNT_NAME: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().email().optional(),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    const formatted = parsed.error.format();
    console.error(JSON.stringify(formatted, null, 2));
    process.exit(1);
  }

  if (
    parsed.data.NODE_ENV === 'production' &&
    (parsed.data.JWT_SECRET.length < 64 ||
      parsed.data.CORS_ORIGIN.split(',').some((origin) =>
        origin.trim().startsWith('http://localhost')
      ))
  ) {
    console.error(
      '❌ Production requires a JWT_SECRET of at least 64 characters and non-localhost CORS_ORIGIN values'
    );
    process.exit(1);
  }

  return parsed.data;
}

export const env = validateEnv();
export type Env = z.infer<typeof envSchema>;
