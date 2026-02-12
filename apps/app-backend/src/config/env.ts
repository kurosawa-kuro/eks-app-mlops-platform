import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { z } from 'zod'

// dotenvをスキーマ検証前に読み込む（ESMホイスティング対策）
// プロジェクトルートの.envを参照
const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '..', '.env') })

const envSchema = z
  .object({
    PORT: z.string().default('8000').transform(Number),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url().optional(),
    JWT_SECRET: z.string().min(32).optional(),
    // JWT expiry in seconds (default: 3600 = 1 hour) - for access token
    JWT_EXPIRY_SECONDS: z.string().default('3600').transform(Number),
    // Access token TTL in seconds (default: 900 = 15 minutes)
    ACCESS_TOKEN_TTL: z.string().default('900').transform(Number),
    // Refresh token TTL in seconds (default: 604800 = 7 days)
    REFRESH_TOKEN_TTL: z.string().default('604800').transform(Number),
    // CSRF protection - allowed origin
    ALLOWED_ORIGIN: z.string().optional(),
    // Token blacklist storage (memory for dev, redis for production)
    TOKEN_BLACKLIST_STORE: z.enum(['memory', 'redis']).default('memory'),
    // Rate limit storage (memory for dev, redis for production)
    RATE_LIMIT_STORE: z.enum(['memory', 'redis']).default('memory'),
    // Redis URL for distributed storage
    REDIS_URL: z.string().optional(),
    // Log mode configuration
    LOG_MODE: z.enum(['console', 'firehose']).default('console'),
    FIREHOSE_STREAM_NAME: z.string().optional(),
    AWS_REGION: z.string().default('ap-northeast-1'),
    // Analytics API configuration (staging-only)
    ENABLE_ANALYTICS_API: z.string().default('false').transform(v => v === 'true'),
    ANALYTICS_S3_BUCKET: z.string().optional(),
    // Error logging (CloudWatch Logs)
    ERROR_LOG_GROUP: z.string().optional(),
    // External auth service URL (for delegating token verification)
    AUTH_SERVICE_URL: z.string().optional(),
    // LLM proxy configuration (internal)
    ENABLE_LLM_API: z.string().default('false').transform(v => v === 'true'),
    LLM_INFERENCE_URL: z.string().url().optional(),
    LLM_EMBEDDINGS_URL: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    // JWT_SECRET is required in production
    if (data.NODE_ENV === 'production' && !data.JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JWT_SECRET is required in production environment (minimum 32 characters)',
        path: ['JWT_SECRET'],
      })
    }
    // Use default only in non-production environments
    if (!data.JWT_SECRET && data.NODE_ENV !== 'production') {
      ;(data as { JWT_SECRET: string }).JWT_SECRET = 'dev-only-jwt-secret-not-for-production'
    }

    // LLM proxy requires upstream URLs
    if (data.ENABLE_LLM_API) {
      if (!data.LLM_INFERENCE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'LLM_INFERENCE_URL is required when ENABLE_LLM_API=true',
          path: ['LLM_INFERENCE_URL'],
        })
      }
      if (!data.LLM_EMBEDDINGS_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'LLM_EMBEDDINGS_URL is required when ENABLE_LLM_API=true',
          path: ['LLM_EMBEDDINGS_URL'],
        })
      }
    }
  })

function loadEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('Environment validation failed:')
    console.error(result.error.format())
    process.exit(1)
  }

  return result.data as z.infer<typeof envSchema> & { JWT_SECRET: string }
}

export const env = loadEnv()
