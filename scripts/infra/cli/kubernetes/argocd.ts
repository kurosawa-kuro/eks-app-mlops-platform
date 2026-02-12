#!/usr/bin/env npx tsx
/**
 * ArgoCD CLI
 *
 * ArgoCD deployment and management via Bastion/SSM.
 *
 * Usage:
 *   npx tsx argocd.ts deploy          # Full deploy (Helm + SSH + Apps)
 *   npx tsx argocd.ts repo-secret     # Create SSH repo secret only
 *   npx tsx argocd.ts status          # Show ArgoCD status
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import type { TerraformOutputs } from '../../infrastructure/types.js';
import type { ContextConfig } from '../../framework/narrative/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { log, c, run } = lib;

// Configuration
const ARGOCD_NAMESPACE = 'argocd';
const ARGOCD_HELM_REPO = 'https://argoproj.github.io/argo-helm';
const GIT_REPO_URL = 'git@github.com:kurosawa-kuro/eks-app-mlops-platform.git';

class ArgoCDCommand extends InfraCommand {
  static override name = 'argocd';
  static override description = 'ArgoCD deployment and management';
  static override commands = {
    deploy: { desc: 'Full deploy (Helm + SSH + Apps)', aliases: [''], requireAws: true },
    'repo-secret': { desc: 'Create SSH repo secret', requireAws: true },
    status: { desc: 'Show ArgoCD status', requireAws: true },
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

  /**
   * Full ArgoCD deployment: Helm + SSH Secret + ApplicationSets
   */
  async cmdDeploy(): Promise<number> {
    if (!this.initTerraform()) return 1;

    const context: ContextConfig = {
      title: 'ArgoCD Full Deploy',
      items: [
        { label: 'Namespace', value: ARGOCD_NAMESPACE },
        { label: 'Bastion', value: this.instanceId || '-' },
      ],
    };
    lib.showContext(context);

    const ssm = new lib.SSMCommandRunner(this.instanceId!, this.region);
    const clusterName = this.tf?.get('cluster_name') || 'prod-eks-cluster';
    const kubeconfigPath = '/tmp/.kube/config';

    // Common kubeconfig setup
    const kubeconfigSetup = [
      'export PATH=/usr/local/bin:$PATH',
      `export KUBECONFIG=${kubeconfigPath}`,
      'mkdir -p /tmp/.kube',
      `aws eks update-kubeconfig --region ${this.region} --name ${clusterName} --kubeconfig ${kubeconfigPath} >/dev/null 2>&1`,
    ].join(' && ');

    // ===========================================
    // Phase 1: Helm Install
    // ===========================================
    log.phase(1, 'Helm Install');

    // Add Helm repo
    log.info('Adding ArgoCD Helm repository...');
    const addRepoResult = await ssm.execute(
      `helm repo add argo ${ARGOCD_HELM_REPO} 2>/dev/null || true && helm repo update`,
      { timeout: 60, label: 'helm repo add', stream: false }
    );
    if (!addRepoResult.success) {
      log.fail(`Failed to add Helm repo: ${addRepoResult.error}`);
      return 1;
    }
    log.pass('Helm repo configured');

    // Create namespace
    log.info('Creating namespace...');
    const nsResult = await ssm.execute(
      `${kubeconfigSetup} && kubectl create namespace ${ARGOCD_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -`,
      { timeout: 30, label: 'create namespace', stream: false }
    );
    if (!nsResult.success) {
      log.fail(`Failed to create namespace: ${nsResult.error}`);
      return 1;
    }
    log.pass('Namespace ready');

    // Helm upgrade --install (include repo add to ensure it's available in same session)
    log.info('Installing ArgoCD via Helm...');
    const helmInstallCmd = [
      kubeconfigSetup,
      `&& helm repo add argo ${ARGOCD_HELM_REPO} 2>/dev/null || true`,
      `&& helm repo update`,
      `&& helm upgrade --install argocd argo/argo-cd`,
      `--namespace ${ARGOCD_NAMESPACE}`,
      `--set server.service.type=ClusterIP`,
      `--wait --timeout 5m`,
    ].join(' ');

    const helmResult = await ssm.execute(helmInstallCmd, {
      timeout: 360,
      label: 'helm install',
      stream: true,
    });
    if (!helmResult.success) {
      log.fail(`Helm install failed: ${helmResult.error}`);
      return 1;
    }
    log.pass('ArgoCD installed');

    // ===========================================
    // Phase 2: SSH Key Secret
    // ===========================================
    log.phase(2, 'SSH Key Secret');

    const secretResult = await this.createRepoSecret(ssm, kubeconfigSetup);
    if (secretResult !== 0) {
      return secretResult;
    }

    // ===========================================
    // Phase 3: Sync + ApplicationSets
    // ===========================================
    log.phase(3, 'Sync + ApplicationSets');

    // Sync workspace to bastion
    log.info('Syncing workspace to bastion...');
    const syncExitCode = await this.syncWorkspace();
    if (syncExitCode !== 0) {
      log.warn('Workspace sync failed, continuing anyway...');
    }

    // Apply ApplicationSets
    log.info('Applying ApplicationSets...');
    const applyResult = await ssm.execute(
      `${kubeconfigSetup} && kubectl apply -k /home/ec2-user/workspace/infra/k8s/argocd`,
      { timeout: 60, label: 'apply applicationsets', stream: false }
    );
    if (!applyResult.success) {
      log.warn(`ApplicationSets apply failed: ${applyResult.error}`);
    } else {
      log.pass('ApplicationSets deployed');
    }

    // ===========================================
    // Summary
    // ===========================================
    console.log('');
    log.pass('ArgoCD Full Deploy Complete');
    console.log('');
    console.log(`  UI:       ${c.cyan('make eks-argocd')}`);
    console.log(`  Password: ${c.cyan('make eks-argocd-password')}`);
    console.log(`  Status:   ${c.cyan('make eks-argocd-status')}`);
    console.log('');

    return 0;
  }

  /**
   * Create SSH repository secret for ArgoCD
   */
  async cmdRepoSecret(): Promise<number> {
    if (!this.initTerraform()) return 1;

    const context: ContextConfig = {
      title: 'ArgoCD Repository Secret',
      items: [
        { label: 'Namespace', value: ARGOCD_NAMESPACE },
        { label: 'Bastion', value: this.instanceId || '-' },
      ],
    };
    lib.showContext(context);

    const ssm = new lib.SSMCommandRunner(this.instanceId!, this.region);
    const clusterName = this.tf?.get('cluster_name') || 'prod-eks-cluster';
    const kubeconfigPath = '/tmp/.kube/config';

    const kubeconfigSetup = [
      'export PATH=/usr/local/bin:$PATH',
      `export KUBECONFIG=${kubeconfigPath}`,
      'mkdir -p /tmp/.kube',
      `aws eks update-kubeconfig --region ${this.region} --name ${clusterName} --kubeconfig ${kubeconfigPath} >/dev/null 2>&1`,
    ].join(' && ');

    return this.createRepoSecret(ssm, kubeconfigSetup);
  }

  /**
   * Show ArgoCD status
   */
  async cmdStatus(): Promise<number> {
    if (!this.initTerraform()) return 1;

    const context: ContextConfig = {
      title: 'ArgoCD Status',
      items: [
        { label: 'Namespace', value: ARGOCD_NAMESPACE },
      ],
    };
    lib.showContext(context);

    const ssm = new lib.SSMCommandRunner(this.instanceId!, this.region);
    const clusterName = this.tf?.get('cluster_name') || 'prod-eks-cluster';
    const kubeconfigPath = '/tmp/.kube/config';

    const kubeconfigSetup = [
      'export PATH=/usr/local/bin:$PATH',
      `export KUBECONFIG=${kubeconfigPath}`,
      'mkdir -p /tmp/.kube',
      `aws eks update-kubeconfig --region ${this.region} --name ${clusterName} --kubeconfig ${kubeconfigPath} >/dev/null 2>&1`,
    ].join(' && ');

    log.section('ApplicationSets & Applications');
    const result = await ssm.execute(
      `${kubeconfigSetup} && kubectl get applicationsets,applications -n ${ARGOCD_NAMESPACE}`,
      { timeout: 30, label: 'get apps', stream: false }
    );

    if (result.output) {
      console.log(result.output);
    }

    return result.success ? 0 : 1;
  }

  /**
   * Create SSH repo secret (shared logic)
   */
  private async createRepoSecret(
    ssm: InstanceType<typeof lib.SSMCommandRunner>,
    kubeconfigSetup: string
  ): Promise<number> {
    // Check for SSH key
    const sshKeyPath = path.join(os.homedir(), '.ssh', 'id_ed25519');
    if (!fs.existsSync(sshKeyPath)) {
      log.fail(`SSH key not found: ${sshKeyPath}`);
      log.info('Generate with: ssh-keygen -t ed25519');
      return 1;
    }

    log.info('Reading SSH private key...');
    const sshPrivateKey = fs.readFileSync(sshKeyPath, 'utf-8').trim();

    // Build Secret YAML
    const secretYaml = `apiVersion: v1
kind: Secret
metadata:
  name: github-repo
  namespace: ${ARGOCD_NAMESPACE}
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
  type: git
  url: ${GIT_REPO_URL}
  sshPrivateKey: |
${sshPrivateKey.split('\n').map(line => '    ' + line).join('\n')}
`;

    // Apply via base64 encoding (to safely pass through SSM)
    const base64Secret = Buffer.from(secretYaml).toString('base64');
    const applyCmd = `${kubeconfigSetup} && echo '${base64Secret}' | base64 -d | kubectl apply -f -`;

    log.info('Applying repository secret...');
    const result = await ssm.execute(applyCmd, {
      timeout: 30,
      label: 'apply secret',
      stream: false,
    });

    if (!result.success) {
      log.fail(`Failed to apply secret: ${result.error}`);
      return 1;
    }

    log.pass('Repository secret registered');
    return 0;
  }

  /**
   * Sync workspace to bastion via S3
   */
  private async syncWorkspace(): Promise<number> {
    // Use the existing sync command from bastion connect
    const result = run(
      `npx tsx ${path.resolve(__dirname, '../../tools/bastion/connect.ts')} sync`,
      { ignoreError: true }
    );
    return result ? 0 : 1;
  }
}

// Entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  ArgoCDCommand.main();
}
