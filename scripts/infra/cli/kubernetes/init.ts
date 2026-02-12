#!/usr/bin/env npx tsx
/**
 * K8s Init CLI
 *
 * Initialize Kubernetes namespace and service account.
 *
 * Usage:
 *   npx tsx k8s-init.ts         # Apply namespace and service account
 *   npx tsx k8s-init.ts run     # Same as above
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import type { TerraformOutputs } from '../../infrastructure/types.js';
import type { ContextConfig } from '../../framework/narrative/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { log, c } = lib;

// Manifests to apply
const MANIFESTS = [
  'infra/k8s/apps/base/namespace.yaml',
  'infra/k8s/apps/base/namespace-database.yaml',
  'infra/k8s/apps/base/serviceaccount.yaml',
];

class K8sInitCommand extends InfraCommand {
  static override name = 'k8s-init';
  static override description = 'Initialize Kubernetes namespace and service account';
  static override commands = {
    run: { desc: 'Apply namespace and service account', aliases: [''], requireAws: true },
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
   * Apply namespace and service account manifests
   */
  async cmdRun(): Promise<number> {
    if (!this.initTerraform()) return 1;

    const context: ContextConfig = {
      title: 'K8s Namespace & ServiceAccount Init',
      items: [
        { label: 'Manifests', value: `${MANIFESTS.length} files` },
        { label: 'Bastion', value: this.instanceId || '-' },
      ],
    };
    lib.showContext(context);

    const ssm = new lib.SSMCommandRunner(this.instanceId!, this.region);
    const kubeconfigSetup = this.getKubeconfigSetup();
    const projectRoot = path.resolve(__dirname, '../../../..');

    let successCount = 0;
    let failCount = 0;

    for (const manifestPath of MANIFESTS) {
      const fullPath = path.join(projectRoot, manifestPath);
      const fileName = path.basename(manifestPath);

      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        log.fail(`Manifest not found: ${manifestPath}`);
        failCount++;
        continue;
      }

      // Read manifest content
      const content = fs.readFileSync(fullPath, 'utf-8');
      const base64Content = Buffer.from(content).toString('base64');

      // Apply via SSM
      log.info(`Applying ${fileName}...`);
      const result = await ssm.execute(
        `${kubeconfigSetup} && echo '${base64Content}' | base64 -d | kubectl apply -f -`,
        { timeout: 30, label: `apply ${fileName}`, stream: false }
      );

      if (result.success) {
        log.pass(`Applied ${fileName}`);
        if (result.output) {
          console.log(c.dim(`  ${result.output.trim()}`));
        }
        successCount++;
      } else {
        log.fail(`Failed to apply ${fileName}: ${result.error}`);
        failCount++;
      }
    }

    // Summary
    console.log('');
    if (failCount === 0) {
      log.pass(`K8s Init Complete (${successCount} manifests applied)`);
      return 0;
    } else {
      log.warn(`K8s Init: ${successCount} succeeded, ${failCount} failed`);
      return 1;
    }
  }
}

// Entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  K8sInitCommand.main();
}
