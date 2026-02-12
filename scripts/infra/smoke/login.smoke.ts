/**
 * Login Smoke Test (E2E)
 *
 * Verifies login functionality end-to-end:
 * - POST /api/auth/login with test credentials
 * - Expects token in response
 */

import { createConfig } from '../config/index.js';
import { createSmoke, ok, warn, fail } from './helpers.js';

interface LoginResponse {
  success?: boolean;
  message?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

async function checkLogin(
  apiUrl: string,
  email: string,
  password: string,
  timeout: number
): Promise<{ ok: boolean; hasToken?: boolean; status?: number; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });

    const body = (await response.json()) as LoginResponse;

    if (response.ok) {
      // access_token は httpOnly Cookie で送信されるため body には含まれない
      // success フィールドで認証成功を判定
      const isAuthenticated = body.success === true;
      return { ok: true, hasToken: isAuthenticated, status: response.status };
    }

    // Rate limited
    if (response.status === 429) {
      return { ok: false, status: 429, error: 'Rate limited - wait 60s' };
    }

    return {
      ok: false,
      status: response.status,
      error: body.message || body.error || 'Login failed',
    };
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return { ok: false, error: 'Timeout' };
    }
    return { ok: false, error: (e as Error).message };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const loginSmoke = createSmoke('login', async () => {
  const config = createConfig();
  const apiUrl = config.apiUrl;

  if (!apiUrl) {
    return warn('API URL not configured (terraform output or API_URL)');
  }

  // Test user credentials (from README)
  const testUser = {
    email: process.env.TEST_USER_EMAIL || 'admin@example.com',
    password: process.env.TEST_USER_PASSWORD || 'CHANGE_ME',
  };

  const result = await checkLogin(apiUrl, testUser.email, testUser.password, 10000);

  if (!result.ok) {
    // Rate limit is a warning (transient)
    if (result.status === 429) {
      return warn(`Login rate limited (429) - wait 60s and retry`, {
        url: `${apiUrl}/api/auth/login`,
        email: testUser.email,
      });
    }

    return fail(`Login failed: ${result.error}`, {
      url: `${apiUrl}/api/auth/login`,
      email: testUser.email,
      status: result.status,
    });
  }

  if (!result.hasToken) {
    return warn('Login succeeded but no token received', {
      url: `${apiUrl}/api/auth/login`,
      email: testUser.email,
    });
  }

  return ok(`Login as ${testUser.email} successful`, {
    url: `${apiUrl}/api/auth/login`,
    email: testUser.email,
    hasToken: true,
  });
});
