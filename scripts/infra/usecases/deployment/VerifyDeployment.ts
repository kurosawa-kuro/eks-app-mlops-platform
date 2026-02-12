/**
 * VerifyDeployment UseCase
 *
 * Verifies EKS deployment: health checks, API tests, login verification.
 * Read-only UseCase (起 phase only).
 */

import { UseCase, type UseCaseResult } from '../base/UseCase.js';
import type { InfraContainer } from '../../container/types.js';
import { log as defaultLog } from '../../framework/logging/index.js';
import { c } from '../../framework/logging/colors.js';

/** Render auth service URL (external dependency) */
const AUTH_SERVICE_URL = 'https://your-auth-gateway.example.com';
const AUTH_WARMUP_TIMEOUT = 60000; // 60 seconds for cold start
const AUTH_WARMUP_INTERVAL = 3000; // Retry every 3 seconds

/**
 * Verification command type.
 */
export type VerifyCommand = 'all' | 'health' | 'login';

/**
 * Input for VerifyDeployment UseCase.
 */
export interface VerifyDeploymentInput {
  /** Command to execute */
  command: VerifyCommand;
  /** API URL */
  apiUrl: string;
  /** App URL */
  appUrl: string;
  /** Test user credentials */
  testUser: {
    email: string;
    password: string;
  };
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Verification result.
 */
export interface VerifyResult {
  /** Check name */
  name: string;
  /** Whether the check passed */
  success: boolean;
  /** Result message */
  message: string;
  /** Additional details */
  details?: string;
}

/**
 * Output from VerifyDeployment UseCase.
 */
export interface VerifyDeploymentOutput {
  /** Command executed */
  command: VerifyCommand;
  /** All checks passed */
  allPassed: boolean;
  /** Individual verification results */
  results: VerifyResult[];
  /** API URL checked */
  apiUrl: string;
  /** App URL checked */
  appUrl: string;
}

/**
 * UseCase for verifying EKS deployment.
 */
export class VerifyDeployment extends UseCase<VerifyDeploymentInput, VerifyDeploymentOutput> {
  constructor(container: InfraContainer) {
    super(container);
  }

  async execute(input: VerifyDeploymentInput): Promise<UseCaseResult<VerifyDeploymentOutput>> {
    this.startTimer();
    const log = defaultLog;
    const timeout = input.timeout || 10000;
    const results: VerifyResult[] = [];

    try {
      log.info(`API URL: ${input.apiUrl}`);
      log.info(`App URL: ${input.appUrl}`);

      switch (input.command) {
        case 'all':
          await this.runPhase('setup', 'Health', 'Running health checks', async () => {
            results.push(await this.verifyApiHealth(input.apiUrl, timeout));
            results.push(await this.verifyFrontendHealth(input.appUrl, timeout));
          });
          await this.runPhase('setup', 'Auth Warmup', 'Warming up auth service', async () => {
            const warmupResult = await this.warmupAuthService();
            results.push(warmupResult);
            if (!warmupResult.success) {
              log.warn('Skipping login test due to auth service unavailability');
              return;
            }
          });
          if (results.every((r) => r.success)) {
            await this.runPhase('setup', 'Login', 'Verifying login', async () => {
              results.push(await this.verifyLogin(input.apiUrl, input.testUser, timeout));
            });
          }
          break;

        case 'health':
          await this.runPhase('setup', 'Health', 'Running health checks', async () => {
            results.push(await this.verifyApiHealth(input.apiUrl, timeout));
            results.push(await this.verifyFrontendHealth(input.appUrl, timeout));
          });
          break;

        case 'login':
          await this.runPhase('setup', 'Auth Warmup', 'Warming up auth service', async () => {
            const warmupResult = await this.warmupAuthService();
            results.push(warmupResult);
            if (!warmupResult.success) {
              log.warn('Skipping login test due to auth service unavailability');
              return;
            }
          });
          if (results.every((r) => r.success)) {
            await this.runPhase('setup', 'Login', 'Verifying login', async () => {
              results.push(await this.verifyLogin(input.apiUrl, input.testUser, timeout));
            });
          }
          break;
      }

      // Log results
      for (const result of results) {
        if (result.success) {
          log.pass(result.message);
          if (result.details) {
            console.log(c.dim(`    ${result.details}`));
          }
        } else {
          log.fail(result.message);
        }
      }

      const allPassed = results.every((r) => r.success);

      return this.buildResult({
        command: input.command,
        allPassed,
        results,
        apiUrl: input.apiUrl,
        appUrl: input.appUrl,
      });
    } catch (error) {
      return this.buildFailedResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Verify API health endpoint.
   */
  private async verifyApiHealth(apiUrl: string, timeout: number): Promise<VerifyResult> {
    const url = `${apiUrl}/health`;
    try {
      const response = await this.fetchWithTimeout(url, {}, timeout);
      const body = await response.text();

      if (response.ok) {
        return {
          name: 'API Health',
          success: true,
          message: `${url} → ${response.status} OK`,
          details: body.substring(0, 100),
        };
      }
      return {
        name: 'API Health',
        success: false,
        message: `${url} → ${response.status} ${response.statusText}`,
      };
    } catch (err) {
      return {
        name: 'API Health',
        success: false,
        message: `${url} → ${(err as Error).message}`,
      };
    }
  }

  /**
   * Verify frontend health.
   */
  private async verifyFrontendHealth(appUrl: string, timeout: number): Promise<VerifyResult> {
    try {
      const response = await this.fetchWithTimeout(appUrl, {}, timeout);

      if (response.ok) {
        return {
          name: 'Frontend Health',
          success: true,
          message: `${appUrl} → ${response.status} OK`,
        };
      }
      return {
        name: 'Frontend Health',
        success: false,
        message: `${appUrl} → ${response.status} ${response.statusText}`,
      };
    } catch (err) {
      return {
        name: 'Frontend Health',
        success: false,
        message: `${appUrl} → ${(err as Error).message}`,
      };
    }
  }

  /**
   * Verify login functionality.
   */
  private async verifyLogin(
    apiUrl: string,
    testUser: { email: string; password: string },
    timeout: number
  ): Promise<VerifyResult> {
    const url = `${apiUrl}/api/auth/login`;
    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: testUser.email,
            password: testUser.password,
          }),
        },
        timeout
      );

      const body = await response.text();
      let jsonBody: Record<string, unknown> | null = null;
      try {
        jsonBody = JSON.parse(body);
      } catch {
        // Not JSON
      }

      if (response.ok) {
        const hasToken = jsonBody && ('token' in jsonBody || 'accessToken' in jsonBody);
        return {
          name: 'Login Test',
          success: true,
          message: `Login as ${testUser.email} → ${response.status} OK`,
          details: hasToken ? 'Token received' : 'Response received',
        };
      }

      // Handle rate limiting
      if (response.status === 429) {
        return {
          name: 'Login Test',
          success: false,
          message: 'Rate limited (429) - wait 60 seconds',
        };
      }

      const errorMsg = jsonBody?.message || jsonBody?.error || body.substring(0, 100);
      return {
        name: 'Login Test',
        success: false,
        message: `Login failed: ${response.status} - ${errorMsg}`,
      };
    } catch (err) {
      return {
        name: 'Login Test',
        success: false,
        message: `Login error: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Fetch with timeout.
   */
  private async fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Warm up the Render auth service (handles cold start).
   * Render free tier services sleep after 15 minutes of inactivity.
   */
  private async warmupAuthService(): Promise<VerifyResult> {
    const log = defaultLog;
    const healthUrl = `${AUTH_SERVICE_URL}/health`;
    const startTime = Date.now();
    let lastError: string | null = null;
    let lastStatus: number | null = null;
    let attempts = 0;

    log.info(`Warming up auth service: ${AUTH_SERVICE_URL}`);

    while (Date.now() - startTime < AUTH_WARMUP_TIMEOUT) {
      attempts++;
      try {
        const response = await this.fetchWithTimeout(healthUrl, {}, 10000);
        lastStatus = response.status;

        if (response.ok) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          return {
            name: 'Auth Service Warmup',
            success: true,
            message: `Auth service ready (${elapsed}s, ${attempts} attempts)`,
            details: AUTH_SERVICE_URL,
          };
        }

        const body = await response.text().catch(() => '');
        lastError = `HTTP ${response.status}: ${body.substring(0, 200)}`;
        log.info(`Auth service not ready (${response.status}), retrying...`);
      } catch (err) {
        const error = err as Error;
        lastError = error.message;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

        // Detailed error logging for cold start diagnosis
        if (error.name === 'AbortError') {
          log.info(`Auth service timeout (cold start likely)... (${elapsed}s)`);
        } else if (error.message.includes('ECONNREFUSED')) {
          log.info(`Auth service connection refused (starting up)... (${elapsed}s)`);
        } else if (error.message.includes('ENOTFOUND')) {
          log.fail(`Auth service DNS lookup failed: ${error.message}`);
        } else {
          log.info(`Auth service waking up: ${error.message} (${elapsed}s)`);
        }
      }

      await this.sleep(AUTH_WARMUP_INTERVAL);
    }

    // Detailed failure message
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const failureDetails = [
      `URL: ${healthUrl}`,
      `Timeout: ${AUTH_WARMUP_TIMEOUT / 1000}s`,
      `Attempts: ${attempts}`,
      lastStatus ? `Last HTTP Status: ${lastStatus}` : null,
      lastError ? `Last Error: ${lastError}` : null,
    ]
      .filter(Boolean)
      .join('\n    ');

    log.fail(`Auth service cold start failed after ${elapsed}s`);
    console.log(c.dim(`    ${failureDetails}`));

    return {
      name: 'Auth Service Warmup',
      success: false,
      message: `Auth service did not respond within ${AUTH_WARMUP_TIMEOUT / 1000}s`,
      details: failureDetails,
    };
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
