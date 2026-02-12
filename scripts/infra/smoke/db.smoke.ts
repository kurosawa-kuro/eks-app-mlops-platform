/**
 * Database Smoke Test (E2E)
 *
 * Verifies database connectivity via the API:
 * - GET /health should include db status
 * - Or GET /api/devtool/health for detailed check
 */

import { createConfig } from '../config/index.js';
import { createSmoke, ok, warn, fail } from './helpers.js';

interface HealthResponse {
  status?: string;
  db?: {
    connected?: boolean;
    status?: string;
  };
  database?: {
    connected?: boolean;
    status?: string;
  };
  [key: string]: unknown;
}

async function checkDbHealth(
  apiUrl: string,
  timeout: number
): Promise<{ ok: boolean; connected?: boolean; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Try devtool health endpoint first (more detailed)
    const devtoolUrl = `${apiUrl}/devtool/health`;
    let response = await fetch(devtoolUrl, { signal: controller.signal });

    // Fallback to regular health if devtool not available
    if (!response.ok) {
      const healthUrl = `${apiUrl}/health`;
      response = await fetch(healthUrl, { signal: controller.signal });
    }

    if (!response.ok) {
      return { ok: false, error: `Health endpoint returned ${response.status}` };
    }

    const body = (await response.json()) as HealthResponse;

    // Check for db status in response
    const dbInfo = body.db || body.database;
    if (dbInfo) {
      const connected = dbInfo.connected === true || dbInfo.status === 'ok';
      return { ok: true, connected };
    }

    // If no db info, assume ok if health endpoint succeeded
    return { ok: true, connected: undefined };
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return { ok: false, error: 'Timeout' };
    }
    return { ok: false, error: (e as Error).message };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const dbSmoke = createSmoke('db', async () => {
  const config = createConfig();
  const apiUrl = config.apiUrl;

  if (!apiUrl) {
    return warn('API URL not configured - cannot check database');
  }

  const result = await checkDbHealth(apiUrl, 10000);

  if (!result.ok) {
    return fail(`Database health check failed: ${result.error}`, {
      url: apiUrl,
    });
  }

  if (result.connected === false) {
    return fail('Database not connected', {
      url: apiUrl,
      connected: false,
    });
  }

  if (result.connected === undefined) {
    return warn('Database status not reported in health check', {
      url: apiUrl,
    });
  }

  return ok('Database connected', {
    url: apiUrl,
    connected: true,
  });
});
