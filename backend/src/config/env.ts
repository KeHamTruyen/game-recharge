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
    .min(16, 'COOKIE_SECRET must be at least 16 characters long')
    .optional(),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    const formatted = parsed.error.format();
    console.error(JSON.stringify(formatted, null, 2));
    process.exit(1);
  }

  return parsed.data;
}

export const env = validateEnv();
export type Env = z.infer<typeof envSchema>;
