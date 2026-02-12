/**
 * Cluster Provisioning Phases
 *
 * Exports all phases used in the cluster provisioning workflow.
 * Each phase represents a distinct step in the 起承転結 narrative.
 */

// Types
export type {
  PhaseResult,
  PhaseContext,
  ExecutablePhase,
  PreflightResult,
  TerraformResult,
  NodeGroupResult,
  ASGInstance,
  K8sNodeInfo,
  SmokeTestResult,
} from './types.js';

// Phase 1: Preflight (起)
export { PreflightPhase } from './PreflightPhase.js';
export type { PreflightPhaseDependencies } from './PreflightPhase.js';

// Phase 2: Terraform (承)
export { TerraformPhase } from './TerraformPhase.js';
export type { TerraformPhaseOptions } from './TerraformPhase.js';

// Phase 3: Cluster Wait (転)
export { ClusterWaitPhase } from './ClusterWaitPhase.js';

// Phase 4: NodeGroup Wait (転)
export { NodeGroupWaitPhase } from './NodeGroupWaitPhase.js';

// Phase 5: ASG Wait (転)
export { ASGWaitPhase } from './ASGWaitPhase.js';
export type { ASGWaitResult } from './ASGWaitPhase.js';

// Phase 6: Bastion Wait (転)
export { BastionWaitPhase } from './BastionWaitPhase.js';

// Phase 7: Node Ready (転) - via SSM
export { NodeReadyPhase } from './NodeReadyPhase.js';
export type { NodeReadyResult } from './NodeReadyPhase.js';

// Phase 8: Smoke Tests (結)
export { SmokeTestPhase } from './SmokeTestPhase.js';
export type { SmokeTestPhaseOptions } from './SmokeTestPhase.js';
