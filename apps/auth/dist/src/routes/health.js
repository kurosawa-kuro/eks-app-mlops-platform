import { Hono } from 'hono';
const health = new Hono();
health.get('/', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
health.get('/status', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
export { health };
