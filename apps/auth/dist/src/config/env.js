import { config } from 'dotenv';
import { z } from 'zod';
// Load .env from project root (standard location)
config();
const envSchema = z.object({
    PORT: z.string().default('38002'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    JWT_SECRET: z.string().default('dummy-secret-key-for-development'),
    // Token TTL (seconds)
    ACCESS_TOKEN_TTL: z.coerce.number().default(3600), // 1 hour
    REFRESH_TOKEN_TTL: z.coerce.number().default(604800), // 7 days
    // Cognito configuration (required for production)
    COGNITO_USER_POOL_ID: z.string().optional(),
    COGNITO_CLIENT_ID: z.string().optional(),
    COGNITO_REGION: z.string().default('ap-northeast-1'),
    // Auth provider selection (dummy for dev/test, cognito for production)
    AUTH_PROVIDER: z.enum(['dummy', 'cognito']).default('cognito'),
    // Redis configuration (optional, for distributed blacklist)
    REDIS_URL: z.string().optional(),
});
function loadEnv() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('Environment validation failed:');
        console.error(result.error.format());
        process.exit(1);
    }
    return result.data;
}
export const env = loadEnv();
