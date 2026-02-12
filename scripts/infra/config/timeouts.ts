/**
 * Timeout and Polling Interval Constants
 *
 * Centralized configuration for all timeout and polling values.
 * All values are in milliseconds for consistency with JavaScript APIs.
 */

/**
 * Timeout values in milliseconds.
 * Use numeric separators for readability (e.g., 1_800_000 = 30 minutes).
 */
export const TIMEOUTS = {
  /** EKS cluster creation/activation */
  cluster: {
    active: 1_800_000,        // 30 minutes
    deletion: 600_000,        // 10 minutes
  },

  /** Node group operations */
  nodeGroup: {
    active: 600_000,          // 10 minutes
    scaling: 300_000,         // 5 minutes
  },

  /** ASG instance operations */
  asg: {
    instanceReady: 600_000,   // 10 minutes
  },

  /** Bastion host operations */
  bastion: {
    ssmOnline: 300_000,       // 5 minutes
  },

  /** Kubernetes operations */
  kubernetes: {
    nodeReady: 300_000,       // 5 minutes
    podReady: 120_000,        // 2 minutes
    jobComplete: 300_000,     // 5 minutes
    deployment: 180_000,      // 3 minutes
  },

  /** Terraform operations */
  terraform: {
    apply: 2_400_000,         // 40 minutes
    destroy: 1_800_000,       // 30 minutes
  },

  /** Command execution */
  command: {
    default: 120_000,         // 2 minutes
    ssm: 60_000,              // 1 minute
  },

  /** Resource deletion */
  deletion: {
    default: 300_000,         // 5 minutes
  },

  /** GPU operations */
  gpu: {
    provisioning: 60_000,     // 1 minute
  },
} as const;

/**
 * Polling interval values in seconds.
 * Used with Poller class which expects seconds.
 */
export const POLL_INTERVALS = {
  /** External AWS API polling (rate limit aware) */
  external: 20,

  /** Internal monitoring/diagnostics */
  internal: 60,

  /** Bastion SSM status */
  bastion: 15,

  /** Resource deletion status */
  deletion: 10,

  /** Default polling interval */
  default: 5,
} as const;

/**
 * Convert seconds to milliseconds.
 * Utility for converting TIMEOUTS values when needed.
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * Convert milliseconds to seconds.
 * Utility for converting when Poller expects seconds.
 */
export function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

