/**
 * KubeconfigPhase - updates kubeconfig for the cluster.
 *
 * Phase 7: Kubernetes Configuration
 */

import { KubernetesMonitor } from '../../../infrastructure/kubernetes/monitor/KubernetesMonitor.js';
import type { ExecutablePhase, PhaseContext, PhaseResult } from './types.js';

/**
 * Options for KubeconfigPhase.
 */
export interface KubeconfigPhaseOptions {
  /** Whether kubectl is available */
  hasKubectl?: boolean;
}

/**
 * Updates kubeconfig for kubectl access.
 */
export class KubeconfigPhase implements ExecutablePhase {
  readonly name = 'Kubeconfig';
  readonly description = 'Updating kubeconfig';
  private readonly options: KubeconfigPhaseOptions;

  constructor(options: KubeconfigPhaseOptions = {}) {
    this.options = options;
  }

  async execute(context: PhaseContext): Promise<PhaseResult> {
    const { clusterName, region, log } = context;

    // Always skip - kubectl access requires bastion for private EKS
    log.info('kubectl access requires bastion');
    log.info('Skipping local kubectl configuration');
    return { success: true, skipped: true, skipReason: 'Private EKS requires bastion access' };
  }
}
