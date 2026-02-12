/**
 * Auth Service Smoke Test
 *
 * Verifies the external auth service (Render) is running.
 */

import { createSmoke, ok, warn, fail } from './helpers.js';

const AUTH_URL = 'https://your-auth-gateway.example.com';

export const authSmoke = createSmoke('auth', async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${AUTH_URL}/health`, { signal: controller.signal });

    if (!response.ok) {
      return fail(`Auth service returned ${response.status}`, { url: AUTH_URL });
    }

    const body = (await response.json()) as { status?: string; uptime?: number };
    const uptime = body.uptime ? Math.floor(body.uptime) : 0;
    return ok(`Auth service is running (uptime: ${uptime}s)`, { url: AUTH_URL, uptime });
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return warn('Auth service timeout (Render cold start?)', { url: AUTH_URL });
    }
    return fail(`Auth service error: ${(e as Error).message}`, { url: AUTH_URL });
  } finally {
    clearTimeout(timeoutId);
  }
});
