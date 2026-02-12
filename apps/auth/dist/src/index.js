// Load dotenv BEFORE any other imports that use env vars
import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
const port = Number(env.PORT);
serve({
    fetch: app.fetch,
    port,
}, (info) => {
    logger.info(`Server is running on http://localhost:${info.port}`);
});
