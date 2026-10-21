import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file if present
dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('3001')
    .transform((val) => {
      const port = parseInt(val, 10);
      if (isNaN(port) || port <= 0 || port > 65535) {
        throw new Error(`Invalid PORT value: ${val}`);
      }
      return port;
    }),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GITHUB_TOKEN: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  GEMINI_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  GEMINI_MODEL: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  GEMINI_BASE_URL: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  AI_TIMEOUT_MS: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && !isNaN(Number(val)) ? Number(val) : undefined)),
  MIN_RELEVANCE_SCORE: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && !isNaN(Number(val)) ? Number(val) : undefined)),
  OPEN_AI_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  OPENAI_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  OPEN_AI_MODEL: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  OPENAI_MODEL: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  OPEN_AI_BASE_URL: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  OPENAI_BASE_URL: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  DATABASE_URL: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
