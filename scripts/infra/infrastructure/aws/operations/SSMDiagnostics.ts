/**
 * SSMDiagnostics - provides SSM-based diagnostics for EC2 instances.
 *
 * Used to troubleshoot EKS node bootstrap issues by checking
 * kubelet status, cloud-init logs, and error patterns.
 */

import { SSMCommandRunner } from '../runtime/SSMCommandRunner.js';
import { awsGetRegion } from '../api/core.js';

/**
 * Common SSM error patterns indicating node bootstrap issues
 */
export const SSM_ERROR_PATTERNS: RegExp[] = [
  /failed to.*kubelet/i,
  /error.*joining.*cluster/i,
  /unable to connect.*api server/i,
  /bootstrap.*failed/i,
  /certificate.*error/i,
  /authentication.*failed/i,
  /timeout.*waiting/i,
  /node.*not.*ready/i,
  /kubelet.*exited/i,
  /containerd.*error/i,
];

/**
 * Default diagnostic commands for SSM
 */
export const SSM_DIAG_COMMANDS: string[] = [
  'echo "=== kubelet status ==="',
  'systemctl status kubelet --no-pager -l 2>/dev/null | tail -20 || true',
  'echo "=== cloud-init status ==="',
  'cloud-init status 2>/dev/null || true',
  'echo "=== cloud-init-output.log (last 30 lines) ==="',
  'tail -30 /var/log/cloud-init-output.log 2>/dev/null || true',
  'echo "=== EKS bootstrap errors ==="',
  'grep -i -E "(error|fail|unable|timeout)" /var/log/messages 2>/dev/null | tail -20 || true',
];

/**
 * Result of error checking
 */
export interface ErrorCheckResult {
  hasError: boolean;
  errors: string[];
}

/**
 * Result of instance diagnostics
 */
export interface DiagnosticsResult {
  instanceId: string;
  status: 'OK' | 'ERROR' | 'NO_LOG';
  errors: string[];
  kubeletStatus?: string;
  cloudInitStatus?: string;
}

/**
 * Configuration for SSMDiagnostics
 */
export interface SSMDiagnosticsConfig {
  region?: string;
  errorPatterns?: RegExp[];
  diagCommands?: string[];
}

/**
 * Provides diagnostic utilities for EC2 instances via SSM.
 *
 * @example
 * const diag = new SSMDiagnostics({ region: 'ap-northeast-1' });
 *
 * // Check for errors in log output
 * const errors = diag.checkErrors(logOutput);
 *
 * // Run full diagnostics on an instance
 * const result = await diag.diagnoseInstance('i-1234567890abcdef0');
 */
export class SSMDiagnostics {
  private readonly region: string;
  private readonly errorPatterns: RegExp[];
  private readonly diagCommands: string[];

  constructor(config: SSMDiagnosticsConfig = {}) {
    this.region = config.region || awsGetRegion();
    this.errorPatterns = config.errorPatterns || SSM_ERROR_PATTERNS;
    this.diagCommands = config.diagCommands || SSM_DIAG_COMMANDS;
  }

  /**
   * Check log output for known error patterns.
   */
  checkErrors(logOutput: string): ErrorCheckResult {
    if (!logOutput) return { hasError: false, errors: [] };

    const errors: string[] = [];
    for (const line of logOutput.split('\n')) {
      if (this.errorPatterns.some((p) => p.test(line))) {
        errors.push(line.trim());
      }
    }

    // Limit to 10 errors to avoid overwhelming output
    return { hasError: errors.length > 0, errors: errors.slice(0, 10) };
  }

  /**
   * Extract a status value from log content using a regex pattern.
   */
  extractStatus(logContent: string, pattern: RegExp): string {
    const match = logContent.match(pattern);
    return match ? match[1] : 'unknown';
  }

  /**
   * Run diagnostics on an EC2 instance via SSM.
   *
   * Executes diagnostic commands and analyzes the output for errors.
   */
  async diagnoseInstance(instanceId: string): Promise<DiagnosticsResult> {
    const runner = new SSMCommandRunner(instanceId, this.region);
    const result = await runner.execute(this.diagCommands.join('\n'), {
      stream: false,
      timeout: 60,
      label: 'Diagnostics',
    });

    const logOutput = result.output || '';
    if (!result.success || !logOutput) {
      return { instanceId, status: 'NO_LOG', errors: [] };
    }

    const errorCheck = this.checkErrors(logOutput);
    return {
      instanceId,
      status: errorCheck.hasError ? 'ERROR' : 'OK',
      errors: errorCheck.errors,
      kubeletStatus: this.extractStatus(logOutput, /Active:\s*(\S+)/),
      cloudInitStatus: this.extractStatus(logOutput, /status:\s*(\S+)/),
    };
  }

  /**
   * Run diagnostics on multiple instances.
   */
  async diagnoseInstances(instanceIds: string[]): Promise<DiagnosticsResult[]> {
    const results: DiagnosticsResult[] = [];
    for (const instanceId of instanceIds) {
      results.push(await this.diagnoseInstance(instanceId));
    }
    return results;
  }
}

/**
 * Static utility methods for quick diagnostics without instantiation.
 */
export const SSMDiagnosticsUtils = {
  /**
   * Quick check for errors in log output.
   */
  checkErrors(logOutput: string): ErrorCheckResult {
    if (!logOutput) return { hasError: false, errors: [] };
    const errors: string[] = [];
    for (const line of logOutput.split('\n')) {
      if (SSM_ERROR_PATTERNS.some((p) => p.test(line))) {
        errors.push(line.trim());
      }
    }
    return { hasError: errors.length > 0, errors: errors.slice(0, 10) };
  },

  /**
   * Quick status extraction from log content.
   */
  extractStatus(logContent: string, pattern: RegExp): string {
    const match = logContent.match(pattern);
    return match ? match[1] : 'unknown';
  },
};
