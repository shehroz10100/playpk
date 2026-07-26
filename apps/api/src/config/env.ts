import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import path from 'node:path';

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_URL: z.string().url().default('http://localhost:4000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),
  STORAGE_PUBLIC_BASE_URL: z.string().default('http://localhost:4000/uploads'),
  SLOT_LOCK_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  LLM_PROVIDER: z.enum(['mock', 'openai']).default('mock'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  /**
   * When false (default in production), free wallet top-ups and auto-succeeding
   * mock payment charges are blocked. Enable only for local/demo.
   */
  ALLOW_MOCK_PAYMENTS: z.preprocess((v) => {
    if (v === 'true' || v === true) return true;
    if (v === 'false' || v === false) return false;
    const env = process.env.NODE_ENV ?? 'development';
    return env !== 'production';
  }, z.boolean()),
  /** Comma-separated browser origins allowed for CORS (production). */
  CORS_ORIGINS: z.string().optional().default(''),
  /** Google OAuth Web client ID (GIS). Optional for local until configured. */
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  /**
   * When true (default in non-production), allow local Google account picker
   * without a real Google ID token. Never enable in production.
   */
  ALLOW_LOCAL_GOOGLE_AUTH: z.preprocess((v) => {
    if (v === 'true' || v === true) return true;
    if (v === 'false' || v === false) return false;
    const env = process.env.NODE_ENV ?? 'development';
    return env !== 'production';
  }, z.boolean()),
  /** Twilio SMS (optional locally; required in production for phone OTP). */
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  /** E.164 sender, e.g. +12025550123 */
  TWILIO_FROM_NUMBER: z.string().optional().default(''),
  /** Alternative to FROM — Messaging Service SID (MG…). */
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional().default(''),
  /**
   * Public dashboard origin for password-reset links.
   * e.g. http://localhost:3000 or https://playpk.vercel.app
   */
  FRONTEND_URL: z.string().url().optional().default('http://localhost:3000'),
  /** Resend API key for transactional email (password reset). Optional locally. */
  RESEND_API_KEY: z.string().optional().default(''),
  /** From address verified in Resend, e.g. PlayPK <noreply@yourdomain.com> */
  EMAIL_FROM: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const appConfig = {
  env: env.NODE_ENV,
  port: env.PORT,
  apiUrl: env.API_URL,
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  storage: {
    driver: env.STORAGE_DRIVER,
    localPath: path.resolve(process.cwd(), env.STORAGE_LOCAL_PATH),
    publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
  },
  slotLockTtlSeconds: env.SLOT_LOCK_TTL_SECONDS,
  llm: {
    provider: env.LLM_PROVIDER,
    openaiApiKey: env.OPENAI_API_KEY,
    openaiModel: env.OPENAI_MODEL,
  },
  allowMockPayments: env.ALLOW_MOCK_PAYMENTS,
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  googleClientId: env.GOOGLE_CLIENT_ID.trim(),
  allowLocalGoogleAuth: env.ALLOW_LOCAL_GOOGLE_AUTH,
  sms: {
    twilio: {
      accountSid: env.TWILIO_ACCOUNT_SID.trim(),
      authToken: env.TWILIO_AUTH_TOKEN.trim(),
      fromNumber: env.TWILIO_FROM_NUMBER.trim(),
      messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID.trim(),
    },
  },
  frontendUrl: env.FRONTEND_URL.replace(/\/$/, ''),
  email: {
    resendApiKey: env.RESEND_API_KEY.trim(),
    emailFrom: env.EMAIL_FROM.trim(),
  },
  isDev: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  isProd: env.NODE_ENV === 'production',
} as const;

export type AppConfig = typeof appConfig;
