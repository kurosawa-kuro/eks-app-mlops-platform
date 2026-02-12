/**
 * Internal Framework Types
 *
 * Types for internal infrastructure tooling (NOT external boundaries).
 * These are Node.js-internal types that do not cross process/network boundaries.
 *
 * =============================================================================
 * SCOPE
 * =============================================================================
 *
 * - UI/Presentation (Colors, Logger)
 * - CLI Framework (CommandDefinition, OptionDefinition)
 * - Internal utilities (Preflight, Poller, SSM Runner)
 * - User interaction (Confirm, FileValidation)
 *
 * =============================================================================
 * NOT ALLOWED HERE
 * =============================================================================
 *
 * - AWS CLI response types (use infrastructure/types.ts)
 * - Zod schemas (use infrastructure/types.ts)
 * - Shell process boundary types (use infrastructure/types.ts)
 *
 * =============================================================================
 */

// ============================================================
// Color Utilities
// ============================================================

export interface Colors {
  reset: string;
  bold: string;
  dim: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
}

export interface ColorFunctions {
  green: (s: string) => string;
  yellow: (s: string) => string;
  red: (s: string) => string;
  cyan: (s: string) => string;
  blue: (s: string) => string;
  magenta: (s: string) => string;
  bold: (s: string) => string;
  dim: (s: string) => string;
}

// ============================================================
// Logging
// ============================================================

export interface Logger {
  pass: (msg: string) => void;
  fail: (msg: string) => void;
  warn: (msg: string) => void;
  info: (msg: string) => void;
  skip: (msg: string) => void;
  dryRun: (msg: string) => void;
  debug: (msg: string) => void;
  header: (text: string) => void;
  section: (title: string) => void;
  phase: (num: number, title: string, color?: 'cyan' | 'red') => void;
  status: (elapsed: number, interval: number, msg: string) => void;
}

// ============================================================
// User Interaction
// ============================================================

export interface ConfirmOptions {
  timeoutMs?: number;
  defaultOnTimeout?: boolean;
}

export interface FileValidationOptions {
  maxSize?: number;
}

// ============================================================
// Preflight Checker
// ============================================================

export interface CheckResult {
  ok: boolean;
  value?: unknown;
  detail?: string;
  error?: string;
  hint?: string;
}

// ============================================================
// Poller
// ============================================================

export interface PollerResult {
  done: boolean;
  success?: boolean;
  [key: string]: unknown;
}

export interface PollerOptions<T extends PollerResult = PollerResult> {
  onTick?: (elapsed: number, interval: number, result: T) => void;
  onSuccess?: (result: T) => void;
  onFailure?: (result: T) => void;
}

export interface PollResult<T extends PollerResult = PollerResult> {
  success: boolean;
  reason?: string;
  elapsed?: number;
  result?: T;
}

// ============================================================
// SSM Command Runner
// ============================================================

export interface SSMExecuteOptions {
  timeout?: number;
  label?: string;
  stream?: boolean;
}

export interface SSMExecuteResult {
  success: boolean;
  output?: string;
  error?: string;
  status?: string;
}

// ============================================================
// Command Definitions (InfraCommand CLI Framework)
// ============================================================

export interface CommandDefinition {
  desc: string;
  args?: string;
  aliases?: string[];
  requireAws?: boolean;
  requireDocker?: boolean;
  handler?: string;
}

export interface OptionDefinition {
  name: string;
  type: 'boolean' | 'string';
  desc?: string;
}

// ============================================================
// Error Handling
// ============================================================

/**
 * Context information for structured errors.
 * Provides additional debugging information when errors occur.
 */
export interface InfraErrorContext {
  /** AWS region where the error occurred */
  region?: string;
  /** EKS cluster name */
  cluster?: string;
  /** AWS resource identifier (ARN, name, ID) */
  resource?: string;
  /** Original AWS error code */
  awsErrorCode?: string;
  /** Original AWS error message */
  awsErrorMessage?: string;
  /** Operation that was being performed */
  operation?: string;
  /** Additional context data */
  [key: string]: unknown;
}

/**
 * Options for withRetry helper function.
 */
export interface WithRetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay between retries in ms (default: 1000) */
  initialDelayMs?: number;
  /** Exponential backoff factor (default: 2) */
  backoffFactor?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelayMs?: number;
  /** Callback when a retry is about to be attempted */
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
  /** Function to determine if error is retryable (default: all errors) */
  isRetryable?: (error: Error) => boolean;
}
