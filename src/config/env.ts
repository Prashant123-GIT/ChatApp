import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().optional(),
  PGUSER: z.string().default('postgres'),
  PGHOST: z.string().default('localhost'),
  PGDATABASE: z.string().default('chat_app_db'),
  PGPASSWORD: z.string().default('admin'),
  PGPORT: z.string().default('5432').transform((val) => parseInt(val, 10)),
  FIREBASE_PROJECT_ID: z.string().default('chat-app-backend'),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  USE_FIRESTORE_MOCK_FALLBACK: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment validation failed');
}

export const env = parsed.data;
