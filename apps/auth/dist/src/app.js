import { Hono } from 'hono';
// Initialize DI container (must be imported before routes)
import './container/index.js';
// Middleware
import { loginRateLimit } from './middleware/rateLimit.js';
import { health } from './routes/health.js';
import { auth } from './routes/auth.js';
const app = new Hono();
// Apply rate limiting to login endpoint (brute-force protection)
app.use('/auth/login', loginRateLimit);
app.get('/', (c) => {
    return c.json({
        name: 'auth-service',
        description: 'Authentication service (Cognito)',
        provider: 'cognito',
        endpoints: {
            login: 'POST /auth/login',
            logout: 'POST /auth/logout',
            me: 'GET /auth/me',
            refresh: 'POST /auth/refresh',
            health: 'GET /health',
        },
    });
});
app.route('/health', health);
app.route('/auth', auth);
export default app;
