/**
 * Command execution utilities.
 * [BOUNDARY: Shell Process]
 */

import { execSync, spawn } from 'child_process';
import type {
  RunOptions,
  RunResult,
  StreamingResult,
  StreamingOptions,
} from '../types.js';

/**
 * Get AWS region from environment or default.
 * Note: Defined here to avoid circular dependency with aws/core.ts
 */
function getDefaultRegion(): string {
  return process.env.AWS_REGION || 'ap-northeast-1';
}

/**
 * [BOUNDARY: Shell Process]
 * Execute shell command synchronously via child_process.execSync.
 */
export function run(cmd: string, options: RunOptions & { throwOnError: false }): RunResult;
export function run(cmd: string, options?: RunOptions): string;
export function run(cmd: string, options: RunOptions = {}): string | RunResult {
  const {
    cwd = process.cwd(),
    silent = false,
    ignoreError = false,
    throwOnError = true,
    timeout = 60000,
    env = {},
  } = options;

  try {
    const result = execSync(cmd, {
      encoding: 'utf8',
      cwd,
      stdio: silent ? 'pipe' : ['pipe', 'pipe', 'pipe'],
      timeout,
      env: { ...process.env, ...env },
      maxBuffer: 10 * 1024 * 1024,
    }).trim();

    return throwOnError ? result : { success: true, output: result };
  } catch (e: unknown) {
    const error = e as { stdout?: Buffer; stderr?: Buffer; message?: string };
    if (ignoreError) return '';
    const output = error.stdout?.toString().trim() || '';
    const stderr = error.stderr?.toString().trim() || '';
    if (!throwOnError) {
      return { success: false, output, stderr, error: e as Error };
    }
    throw new Error(stderr || output || error.message || 'Command failed');
  }
}

/**
 * [BOUNDARY: AWS CLI]
 * AWS CLI wrapper that auto-adds --region if not present.
 */
export function aws(args: string, options: RunOptions & { throwOnError: false }): RunResult;
export function aws(args: string, options?: RunOptions): string;
export function aws(args: string, options: RunOptions = {}): string | RunResult {
  const region = options.region || getDefaultRegion();
  const hasRegion = /\s--region(\s|=|$)/.test(args);
  const cmd = `aws ${args}${hasRegion ? '' : ` --region ${region}`}`;

  if (options.throwOnError === false) {
    return run(cmd, { ...options, throwOnError: false });
  }
  return run(cmd, options);
}

/**
 * Async sleep helper
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * [BOUNDARY: Shell Process - Streaming]
 * Execute shell command with streaming output via child_process.spawn.
 * Supports optional timeout to kill hung processes.
 */
export function runStreaming(
  cmd: string,
  args: string[],
  cwd: string,
  options: StreamingOptions = {}
): Promise<StreamingResult> {
  const { shell = false, timeout } = options;
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: ['inherit', 'pipe', 'pipe'], shell });
    let stdout = '';
    let stderr = '';
    let killed = false;
    let timeoutId: NodeJS.Timeout | undefined;

    if (timeout && timeout > 0) {
      timeoutId = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!proc.killed) proc.kill('SIGKILL');
        }, 5000);
      }, timeout);
    }

    proc.stdout.on('data', (d: Buffer) => { stdout += d; process.stdout.write(d); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d; process.stderr.write(d); });
    proc.on('close', (code: number | null) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (killed) {
        reject(new Error(`Process timed out after ${timeout}ms`));
      } else if (code === 0) {
        resolve({ stdout, stderr, code: code || 0 });
      } else {
        reject(new Error(`Exit code ${code}`));
      }
    });
    proc.on('error', (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });
  });
}
