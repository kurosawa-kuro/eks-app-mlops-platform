#!/usr/bin/env npx tsx
/**
 * Monitoring CLI
 *
 * Prometheus, Grafana, Loki, Alertmanager deployment and management via Bastion/SSM.
 *
 * Usage:
 *   npx tsx monitoring.ts deploy   # Deploy monitoring stack
 *   npx tsx monitoring.ts status   # Show monitoring status
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import type { TerraformOutputs } from '../../infrastructure/types.js';
import type { ContextConfig } from '../../framework/narrative/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { log, c, run } = lib;

// Configuration
const MONITORING_NAMESPACE = 'monitoring';

class MonitoringCommand extends InfraCommand {
  static override name = 'monitoring';
  static override description = 'Monitoring stack deployment and management';
  static override commands = {
    deploy: { desc: 'Deploy Prometheus/Grafana/Loki stack', aliases: [''], requireAws: true },
    status: { desc: 'Show monitoring status', requireAws: true },
  };

  private tf: TerraformOutputs | null = null;
  private instanceId: string | null = null;

  // Note: region is inherited from InfraCommand

  private initTerraform(): boolean {
    const tfDir = path.resolve(__dirname, '../../../../infra/terraform/prod');
    this.tf = lib.createTerraformOutputs(tfDir);
    this.instanceId = this.tf.bastionId();

    if (!this.instanceId) {
      log.fail('Bastion instance ID not found. Run terraform apply first.');
      return false;
    }

    try {
      this.instanceId = lib.validateInstanceId(this.instanceId);
    } catch (e) {
      log.fail(`Invalid instance ID: ${(e as Error).message}`);
      return false;
    }
    return true;
  }

  private getKubeconfigSetup(): string {
    const clusterName = this.tf?.get('cluster_name') || 'prod-eks-cluster';
    const kubeconfigPath = '/tmp/.kube/config';
    return [
      'export PATH=/usr/local/bin:$PATH',
      `export KUBECONFIG=${kubeconfigPath}`,
      'mkdir -p /tmp/.kube',
      `aws eks update-kubeconfig --region ${this.region} --name ${clusterName} --kubeconfig ${kubeconfigPath} >/dev/null 2>&1`,
    ].join(' && ');
  }

  /**
   * Deploy monitoring stack: Prometheus, Grafana, Loki, Alertmanager
   */
  async cmdDeploy(): Promise<number> {
    if (!this.initTerraform()) return 1;

    const context: ContextConfig = {
      title: 'Monitoring Stack Deploy',
      items: [
        { label: 'Namespace', value: MONITORING_NAMESPACE },
        { label: 'Components', value: 'Prometheus, Grafana, Loki, Alertmanager' },
        { label: 'Bastion', value: this.instanceId || '-' },
      ],
    };
    lib.showContext(context);

    const ssm = new lib.SSMCommandRunner(this.instanceId!, this.region);
    const kubeconfigSetup = this.getKubeconfigSetup();

    // ===========================================
    // Phase 1: Sync Workspace
    // ===========================================
    log.phase(1, 'Sync Workspace');

    log.info('Syncing workspace to bastion...');
    const syncExitCode = await this.syncWorkspace();
    if (syncExitCode !== 0) {
      log.warn('Workspace sync failed, continuing anyway...');
    } else {
      log.pass('Workspace synced');
    }

    // ===========================================
    // Phase 2: Apply Kustomize
    // ===========================================
    log.phase(2, 'Apply Monitoring Stack');

    log.info('Applying monitoring Kustomize overlay...');
    const applyResult = await ssm.execute(
      `${kubeconfigSetup} && kubectl apply -k /home/ec2-user/workspace/infra/k8s/monitoring/overlays/prod`,
      { timeout: 120, label: 'apply monitoring', stream: true }
    );
    if (!applyResult.success) {
      log.fail(`Failed to apply monitoring stack: ${applyResult.error}`);
      return 1;
    }
    log.pass('Monitoring manifests applied');

    // ===========================================
    // Phase 3: Wait for Rollout
    // ===========================================
    log.phase(3, 'Wait for Rollout');

    log.info('Waiting for Prometheus...');
    const promResult = await ssm.execute(
      `${kubeconfigSetup} && kubectl rollout status deployment/prometheus -n ${MONITORING_NAMESPACE} --timeout=120s`,
      { timeout: 150, label: 'prometheus rollout', stream: false }
    );
    if (!promResult.success) {
      log.warn('Prometheus rollout not complete');
    } else {
      log.pass('Prometheus ready');
    }

    log.info('Waiting for Grafana...');
    const grafResult = await ssm.execute(
      `${kubeconfigSetup} && kubectl rollout status deployment/grafana -n ${MONITORING_NAMESPACE} --timeout=120s`,
      { timeout: 150, label: 'grafana rollout', stream: false }
    );
    if (!grafResult.success) {
      log.warn('Grafana rollout not complete');
    } else {
      log.pass('Grafana ready');
    }

    // ===========================================
    // Phase 4: Status Check
    // ===========================================
    log.phase(4, 'Status');

    await this.showStatus(ssm, kubeconfigSetup);

    // ===========================================
    // Summary
    // ===========================================
    console.log('');
    log.pass('Monitoring Stack Deploy Complete');
    console.log('');
    console.log(`  Grafana:     ${c.cyan('make eks-monitoring-grafana')} (admin / see grafana secret)`);
    console.log(`  Prometheus:  ${c.cyan('make eks-monitoring-prometheus')}`);
    console.log(`  Alertmanager:${c.cyan('make eks-monitoring-alertmanager')}`);
    console.log(`  Loki:        ${c.cyan('make eks-monitoring-loki')}`);
    console.log('');

    return 0;
  }

  /**
   * Show monitoring status
   */
  async cmdStatus(): Promise<number> {
    if (!this.initTerraform()) return 1;

    const context: ContextConfig = {
      title: 'Monitoring Status',
      items: [
        { label: 'Namespace', value: MONITORING_NAMESPACE },
      ],
    };
    lib.showContext(context);

    const ssm = new lib.SSMCommandRunner(this.instanceId!, this.region);
    const kubeconfigSetup = this.getKubeconfigSetup();

    return this.showStatus(ssm, kubeconfigSetup);
  }

  /**
   * Show status (shared logic)
   */
  private async showStatus(
    ssm: InstanceType<typeof lib.SSMCommandRunner>,
    kubeconfigSetup: string
  ): Promise<number> {
    log.section('Monitoring Stack Status');
    const result = await ssm.execute(
      `${kubeconfigSetup} && kubectl get all -n ${MONITORING_NAMESPACE}`,
      { timeout: 30, label: 'get resources', stream: false }
    );

    if (result.output) {
      console.log(result.output);
    }

    return result.success ? 0 : 1;
  }

  /**
   * Sync workspace to bastion via S3
   */
  private async syncWorkspace(): Promise<number> {
    const result = run(
      `npx tsx ${path.resolve(__dirname, '../../tools/bastion/connect.ts')} sync`,
      { ignoreError: true }
    );
    return result ? 0 : 1;
  }
}

// Entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  MonitoringCommand.main();
}
