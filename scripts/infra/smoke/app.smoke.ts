/**
 * App Smoke Test
 *
 * Verifies application /health endpoint is responding.
 */

import { run } from '../infrastructure/shell/index.js';
import { createConfig } from '../config/index.js';
import { createSmoke, ok, warn, fail } from './helpers.js';

interface HealthResponse {
  status?: string;
  [key: string]: unknown;
}

function checkHealthEndpoint(url: string): { ok: boolean; response?: HealthResponse; error?: string } {
  try {
    const result = run(`curl -sf --connect-timeout 5 --max-time 10 "${url}"`, { silent: true });
    try {
      const parsed = JSON.parse(result) as HealthResponse;
      return { ok: true, response: parsed };
    } catch {
      return { ok: true, response: { raw: result.substring(0, 200) } };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export const appSmoke = createSmoke('app', () => {
  const config = createConfig();
  const apiUrl = config.apiUrl;

  if (!apiUrl) {
    return warn('API URL not configured (terraform output or API_URL)');
  }

  const healthUrl = `${apiUrl}/health`;
  const result = checkHealthEndpoint(healthUrl);

  if (!result.ok) {
    return fail(`Health endpoint unreachable: ${healthUrl}`, { url: healthUrl, error: result.error });
  }

  return ok(`Health check passed: ${healthUrl}`, { url: healthUrl, response: result.response });
});
