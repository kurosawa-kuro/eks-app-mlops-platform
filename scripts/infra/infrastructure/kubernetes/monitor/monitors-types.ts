/**
 * Monitor Types
 *
 * Type definitions for resource monitoring classes.
 */

import type { Logger } from '../../../framework/types.js';
import type { ASGInstance } from '../../types.js';

// ============================================================
// Common Monitor Configuration
// ============================================================

/**
 * Base configuration for all monitors.
 */
export interface MonitorConfig {
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Polling interval in seconds */
  intervalSec: number;
  /** AWS region */
  region?: string;
  /** Logger instance for output */
  logger?: Logger;
}

/**
 * Base result for all monitors.
 */
export interface MonitorResult {
  success: boolean;
  reason?: string;
}

// ============================================================
// Cluster Monitor Types
// ============================================================

export interface ClusterMonitorResult extends MonitorResult {
  status?: string;
}

// ============================================================
// NodeGroup Monitor Types
// ============================================================

export interface NodeGroupInfo {
  name: string;
  status: string;
  desiredSize?: number;
  asgName?: string;
  healthIssues: Array<{ code: string; message: string }>;
}

export interface NodeGroupMonitorResult extends MonitorResult {
  details: NodeGroupInfo[];
  failedNodeGroup?: NodeGroupInfo;
}

// ============================================================
// ASG Monitor Types
// ============================================================

// ASGInstance is re-exported from ../types.js
export type { ASGInstance };

export interface ASGMonitorResult extends MonitorResult {
  instances: ASGInstance[];
  inServiceCount: number;
  ssmOnlineCount: number;
}

// ============================================================
// Bastion Monitor Types
// ============================================================

export interface BastionMonitorResult extends MonitorResult {
  amiName?: string;
  agentVersion?: string;
}
