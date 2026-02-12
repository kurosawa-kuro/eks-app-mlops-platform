/**
 * Smoke Test Type Definitions
 */

// ============================================================
// Smoke Test Status & Results
// ============================================================

export type SmokeStatus = 'ok' | 'warn' | 'fail';

export interface SmokeResult {
  name: string;
  status: SmokeStatus;
  message?: string;
  detail?: unknown;
  durationMs: number;
}

export interface SmokeReport {
  timestamp: string;
  results: SmokeResult[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failed: number;
  };
  exitCode: number;
}

// ============================================================
// Smoke Test Options
// ============================================================

export interface SmokeOptions {
  json?: boolean;
  skipApp?: boolean;
  skipE2E?: boolean;      // Skip E2E tests (login, db)
  strict?: boolean;       // Exit 1 on any failure
  warnAsError?: boolean;  // Treat warnings as failures (requires strict)
}

// ============================================================
// Exit Codes
// ============================================================

export const EXIT_CODES = {
  // Infrastructure tests
  aws: 10,
  eks: 20,
  k8s: 30,
  app: 40,
  auth: 45,
  // Monitoring tests
  monitoring: 70,
  prometheus: 71,
  grafana: 72,
  loki: 73,
  alertmanager: 74,
  // E2E tests
  login: 50,
  db: 60,
} as const;

export type SmokeTestName = keyof typeof EXIT_CODES;
