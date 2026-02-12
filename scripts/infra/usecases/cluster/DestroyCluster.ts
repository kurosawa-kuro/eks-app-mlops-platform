/**
 * DestroyCluster UseCase
 *
 * Destroys an EKS cluster and cleans up all related AWS resources.
 * Follows the 起承転結 narrative:
 * - 起: Preflight checks, resource discovery
 * - 承: K8s cleanup, KMS grants
 * - 転: AWS resource cleanup (ALB, TG, NodeGroup, VPC, NAT, EIP, ENI, EBS, SG, S3, CloudWatch)
 * - 結: Terraform destroy
 */

import type { InfraContainer } from '../../container/types.js';
import { UseCase, type UseCaseResult } from '../base/UseCase.js';
import { log } from '../../framework/logging/index.js';
import { aws, run, runStreaming } from '../../infrastructure/shell/index.js';
import { toError, safeParseJson } from '../../infrastructure/types.js';
import { createResourceCleaner, type CleanerConfig, type CleanerResult } from '../../infrastructure/aws/operations/ResourceCleaner.js';
import { eksListNodeGroups } from '../../infrastructure/aws/api/eks.js';
import { SSMCommandRunner, ssmGetInstanceStatus } from '../../infrastructure/aws/runtime/SSMCommandRunner.js';

// Import Zod schemas for AWS responses
import {
  ALBListSchema,
  TargetGroupListSchema,
  VpcEndpointListSchema,
  NatGatewayListSchema,
  ElasticIPListSchema,
  NetworkInterfaceListSchema,
  SecurityGroupRuleListSchema,
  SecurityGroupListSchema,
  S3ObjectVersionListSchema,
  EBSVolumeListSchema,
  KarpenterNodeListSchema,
  StringArraySchema,
  type ALBResponse,
  type TargetGroupResponse,
  type VpcEndpointResponse,
  type NatGatewayResponse,
  type ElasticIPResponse,
  type NetworkInterfaceResponse,
  type SecurityGroupResponse,
  type EBSVolumeResponse,
  type KarpenterNodeResponse,
} from '../../infrastructure/types.js';

/**
 * Input for cluster destruction.
 */
export interface DestroyClusterInput {
  /** Dry-run mode - don't actually delete */
  dryRun: boolean;
  /** Skip K8s cleanup */
  skipK8s: boolean;
  /** Skip Terraform destroy */
  skipTerraform: boolean;
  /** Force mode - skip confirmations */
  force: boolean;
  /** Terraform directory */
  tfDir: string;
  /** AWS region */
  region: string;
  /** Cluster name */
  clusterName?: string;
}

/**
 * Output from cluster destruction.
 */
export interface DestroyClusterOutput {
  /** Total resources deleted */
  resourcesDeleted: number;
  /** Duration in seconds */
  durationSeconds: number;
  /** Cleanup results by resource type */
  cleanupResults: Record<string, CleanerResult>;
  /** K8s cleanup instructions shown */
  k8sInstructionsShown: boolean;
  /** Terraform destroy completed */
  terraformDestroyed: boolean;
}

/**
 * Context for resource discovery.
 */
interface DestroyContext {
  vpcId: string | null;
  clusterName: string;
  bastionId: string | null;
  region: string;
  tfDir: string;
  dryRun: boolean;
  cleanerConfig: CleanerConfig;
}

/**
 * KMS Grant info.
 */
interface KmsGrant {
  GrantId: string;
  KeyId: string;
  GranteePrincipal: string;
  Operations: string[];
}

/**
 * Pre-flight check result.
 */
interface PreflightCheckResult {
  passed: boolean;
  warnings: string[];
  blockers: string[];
  resourceSummary: {
    terraformResources: number;
    clusterExists: boolean;
    loadBalancerServices: number;
    pvcs: number;
  };
}

/**
 * Cleanup task definition for parallel execution.
 */
interface CleanupTask {
  name: string;
  fn: () => Promise<CleanerResult>;
}

/**
 * Parallel cleanup group - tasks within a group run in parallel.
 */
interface ParallelCleanupGroup {
  name: string;
  description: string;
  tasks: CleanupTask[];
  /** If true, tasks run sequentially within this group */
  sequential?: boolean;
}

/**
 * Destroys an EKS cluster and all related resources.
 */
export class DestroyCluster extends UseCase<DestroyClusterInput, DestroyClusterOutput> {
  constructor(container: InfraContainer) {
    super(container);
  }

  async execute(input: DestroyClusterInput): Promise<UseCaseResult<DestroyClusterOutput>> {
    this.startTimer();
    const startTime = Date.now();

    const cleanupResults: Record<string, CleanerResult> = {};
    let k8sInstructionsShown = false;
    let terraformDestroyed = false;
    let totalDeleted = 0;

    // Build context
    const ctx: DestroyContext = {
      vpcId: null,
      clusterName: input.clusterName || 'prod-eks-cluster',
      bastionId: null,
      region: input.region,
      tfDir: input.tfDir,
      dryRun: input.dryRun,
      cleanerConfig: {
        dryRun: input.dryRun,
        deleteTimeout: 300,
        pollInterval: 5,
      },
    };

    try {
      // ============================================================
      // 起: Setup - Preflight checks and resource discovery
      // ============================================================
      let preflightResult: PreflightCheckResult | null = null;
      await this.runPhase('setup', 'Preflight', 'Running enhanced preflight checks', async () => {
        preflightResult = await this.executePreflightChecks(ctx);
        if (!preflightResult.passed) {
          for (const blocker of preflightResult.blockers) {
            log.fail(blocker);
          }
          throw new Error('Preflight checks failed. Aborting destroy.');
        }
      });

      await this.runPhase('setup', 'Discovery', 'Discovering resources', async () => {
        this.discoverResources(ctx);
      });

      // ============================================================
      // 承: Action - K8s cleanup and KMS grants
      // ============================================================
      if (input.skipK8s) {
        this.skipPhase('action', 'K8s Cleanup', 'Kubernetes resource cleanup', 'Skipped by user (--skip-k8s)');
      } else {
        await this.runPhase('action', 'K8s Cleanup', 'Kubernetes resource cleanup (automated via SSM)', async () => {
          const k8sResult = await this.executeK8sCleanup(ctx);
          k8sInstructionsShown = !k8sResult.automated; // true if fell back to manual instructions
        });
      }

      await this.runPhase('action', 'KMS Grants', 'Cleaning up KMS grants', async () => {
        await this.cleanupKmsGrants(ctx);
      });

      // ============================================================
      // 転: Transition - AWS resource cleanup (parallel groups)
      // ============================================================
      const cleanupGroups: ParallelCleanupGroup[] = [
        {
          name: 'Load Balancer Resources',
          description: 'ALB, Target Groups (並列)',
          tasks: [
            { name: 'ALB', fn: () => this.cleanupAlbs(ctx) },
            { name: 'Target Groups', fn: () => this.cleanupTargetGroups(ctx) },
          ],
        },
        {
          name: 'Node Resources',
          description: 'Karpenter → Node Groups (逐次)',
          sequential: true,
          tasks: [
            { name: 'Karpenter Nodes', fn: () => this.cleanupKarpenterNodes(ctx) },
            { name: 'Node Groups', fn: () => this.cleanupNodeGroups(ctx) },
          ],
        },
        {
          name: 'Network Resources',
          description: 'VPC Endpoints, NAT Gateways (並列)',
          tasks: [
            { name: 'VPC Endpoints', fn: () => this.cleanupVpcEndpoints(ctx) },
            { name: 'NAT Gateways', fn: () => this.cleanupNatGateways(ctx) },
          ],
        },
        {
          name: 'Cleanup Resources',
          description: 'EIPs, ENIs, EBS Volumes (並列)',
          tasks: [
            { name: 'Elastic IPs', fn: () => this.cleanupEips(ctx) },
            { name: 'ENIs', fn: () => this.cleanupEnis(ctx) },
            { name: 'EBS Volumes', fn: () => this.cleanupEbsVolumes(ctx) },
          ],
        },
        {
          name: 'Storage & Logs',
          description: 'S3 Buckets, CloudWatch Logs (並列)',
          tasks: [
            { name: 'S3 Buckets', fn: () => this.cleanupS3Buckets(ctx) },
            { name: 'CloudWatch Logs', fn: () => this.cleanupLogGroups(ctx) },
          ],
        },
        // Security Groups は Post-cleanup で処理（Terraform destroy 後）
      ];

      // Execute cleanup groups
      for (const group of cleanupGroups) {
        await this.runPhase('transition', group.name, group.description, async () => {
          const groupResults = await this.executeCleanupGroup(group);
          for (const [name, result] of Object.entries(groupResults)) {
            cleanupResults[name] = result;
            totalDeleted += result.deleted;
          }
        });
      }

      // ============================================================
      // 結: Verification - Terraform destroy
      // ============================================================
      if (input.skipTerraform) {
        this.skipPhase('verification', 'Terraform Destroy', 'Terraform destroy', 'Skipped by user (--skip-terraform)');
      } else {
        await this.runPhase('verification', 'Terraform Destroy', 'Running terraform destroy', async () => {
          terraformDestroyed = await this.runTerraformDestroy(ctx);
        });
      }

      // ============================================================
      // Post-cleanup: Security Groups (after Terraform destroy)
      // ============================================================
      await this.runPhase('verification', 'Post-cleanup', 'Cleaning up remaining Security Groups', async () => {
        const sgResult = await this.cleanupSecurityGroupsWithRetry(ctx);
        cleanupResults['Security Groups'] = sgResult;
        totalDeleted += sgResult.deleted;
      });

      const durationSeconds = Math.round((Date.now() - startTime) / 1000);

      return this.buildResult({
        resourcesDeleted: totalDeleted,
        durationSeconds,
        cleanupResults,
        k8sInstructionsShown,
        terraformDestroyed,
      });
    } catch (error) {
      if (error instanceof Error) {
        return this.buildFailedResult(error);
      }
      return this.buildFailedResult(new Error(String(error)));
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private tfOutput(key: string, tfDir: string): string {
    return run(`terraform output -raw ${key}`, { cwd: tfDir, ignoreError: true }) || '';
  }

  private matchesProject(name: string | undefined, clusterName: string): boolean {
    if (!name) return false;
    return name.startsWith('k8s-') || name.startsWith(`${clusterName}-`);
  }

  // ============================================================
  // 起: Preflight and Discovery
  // ============================================================

  private discoverResources(ctx: DestroyContext): void {
    const name = this.tfOutput('cluster_name', ctx.tfDir);
    if (name) ctx.clusterName = name;
    log.pass(`Cluster: ${ctx.clusterName}`);

    ctx.vpcId = this.tfOutput('vpc_id', ctx.tfDir);
    if (!ctx.vpcId) {
      const result = aws(
        `ec2 describe-vpcs --filters "Name=tag:Project,Values=${ctx.clusterName}" --query 'Vpcs[0].VpcId' --output text`,
        { ignoreError: true, region: ctx.region }
      );
      if (result && result !== 'None') ctx.vpcId = result;
    }
    ctx.vpcId ? log.pass(`VPC: ${ctx.vpcId}`) : log.warn('VPC not found');

    ctx.bastionId = this.tfOutput('bastion_instance_id', ctx.tfDir);
    if (ctx.bastionId) log.pass(`Bastion: ${ctx.bastionId}`);
  }

  /**
   * Execute enhanced pre-flight checks to identify potential issues before destruction.
   */
  private async executePreflightChecks(ctx: DestroyContext): Promise<PreflightCheckResult> {
    const result: PreflightCheckResult = {
      passed: true,
      warnings: [],
      blockers: [],
      resourceSummary: {
        terraformResources: 0,
        clusterExists: false,
        loadBalancerServices: 0,
        pvcs: 0,
      },
    };

    // 0. Basic tool checks
    log.info('Checking AWS CLI...');
    try {
      run('which aws');
    } catch {
      result.blockers.push('AWS CLI not found. Please install AWS CLI.');
      result.passed = false;
      return result;
    }

    log.info('Checking AWS credentials...');
    try {
      const accountId = run('aws sts get-caller-identity --query Account --output text');
      log.pass(`Account: ${accountId}`);
    } catch {
      result.blockers.push('AWS credentials not configured. Please run `aws configure`.');
      result.passed = false;
      return result;
    }

    // Get bastion ID if not already set (needed for K8s checks)
    if (!ctx.bastionId) {
      ctx.bastionId = this.tfOutput('bastion_instance_id', ctx.tfDir);
    }

    // 1. Check Terraform state
    log.info('Checking Terraform state...');
    const stateList = run('terraform state list', { cwd: ctx.tfDir, ignoreError: true });
    const resourceCount = stateList ? stateList.split('\n').filter(Boolean).length : 0;
    result.resourceSummary.terraformResources = resourceCount;

    if (resourceCount === 0) {
      result.blockers.push('No resources in Terraform state. Nothing to destroy.');
      result.passed = false;
      return result;
    }
    log.pass(`${resourceCount} resources in Terraform state`);

    // 2. Check if EKS cluster exists
    log.info('Checking EKS cluster existence...');
    const clusterStatus = aws(
      `eks describe-cluster --name ${ctx.clusterName} --query 'cluster.status' --output text`,
      { ignoreError: true, region: ctx.region }
    );
    result.resourceSummary.clusterExists = !!(clusterStatus && clusterStatus !== 'None');
    if (result.resourceSummary.clusterExists) {
      log.pass(`EKS cluster exists (status: ${clusterStatus})`);
    } else {
      result.warnings.push('EKS cluster not found. Some cleanup steps may be skipped.');
      log.warn('EKS cluster not found');
    }

    // 3. Check K8s resources via SSM (if Bastion available)
    if (ctx.bastionId && result.resourceSummary.clusterExists) {
      const ssmStatus = ssmGetInstanceStatus(ctx.bastionId, ctx.region);
      if (ssmStatus.status === 'Online') {
        log.info('Checking K8s resources via SSM...');
        const k8sCheckResult = await this.checkK8sResources(ctx);
        result.resourceSummary.loadBalancerServices = k8sCheckResult.loadBalancerCount;
        result.resourceSummary.pvcs = k8sCheckResult.pvcCount;

        if (k8sCheckResult.loadBalancerCount > 0) {
          result.warnings.push(
            `Found ${k8sCheckResult.loadBalancerCount} LoadBalancer service(s). ` +
            `These will be cleaned up automatically, but may take extra time.`
          );
          log.warn(`${k8sCheckResult.loadBalancerCount} LoadBalancer service(s) found`);
        } else {
          log.pass('No LoadBalancer services found');
        }

        if (k8sCheckResult.pvcCount > 0) {
          result.warnings.push(
            `Found ${k8sCheckResult.pvcCount} PVC(s). ` +
            `These will be deleted during K8s cleanup.`
          );
          log.warn(`${k8sCheckResult.pvcCount} PVC(s) found`);
        } else {
          log.pass('No PVCs found');
        }
      } else {
        log.info('SSM agent not online - skipping K8s resource checks');
      }
    }

    // 4. Display summary
    if (result.warnings.length > 0) {
      console.log('');
      log.warn('Pre-flight warnings:');
      for (const warning of result.warnings) {
        console.log(`  - ${warning}`);
      }
      console.log('');
    }

    return result;
  }

  /**
   * Check K8s resources (LoadBalancer services, PVCs) via SSM.
   */
  private async checkK8sResources(ctx: DestroyContext): Promise<{ loadBalancerCount: number; pvcCount: number }> {
    if (!ctx.bastionId) {
      return { loadBalancerCount: 0, pvcCount: 0 };
    }

    const kubeconfigPath = '/tmp/.kube/config';
    const checkScript = `
set -e
export PATH=/usr/local/bin:$PATH
export HOME=/root
export KUBECONFIG=${kubeconfigPath}

mkdir -p /tmp/.kube
aws eks update-kubeconfig --region ${ctx.region} --name ${ctx.clusterName} --kubeconfig ${kubeconfigPath} 2>/dev/null

# Count LoadBalancer services
LB_COUNT=$(kubectl get svc -A -o json 2>/dev/null | jq '[.items[] | select(.spec.type=="LoadBalancer")] | length' 2>/dev/null || echo "0")
echo "LB_COUNT:$LB_COUNT"

# Count PVCs
PVC_COUNT=$(kubectl get pvc -A -o json 2>/dev/null | jq '.items | length' 2>/dev/null || echo "0")
echo "PVC_COUNT:$PVC_COUNT"
`.trim();

    try {
      const ssm = new SSMCommandRunner(ctx.bastionId, ctx.region);
      const result = await ssm.execute(checkScript, {
        timeout: 60,
        label: 'K8s Resource Check',
        stream: false,
      });

      if (result.success && result.output) {
        const lbMatch = result.output.match(/LB_COUNT:(\d+)/);
        const pvcMatch = result.output.match(/PVC_COUNT:(\d+)/);
        return {
          loadBalancerCount: lbMatch ? parseInt(lbMatch[1], 10) : 0,
          pvcCount: pvcMatch ? parseInt(pvcMatch[1], 10) : 0,
        };
      }
    } catch {
      // Silently fail - this is just a pre-check
    }

    return { loadBalancerCount: 0, pvcCount: 0 };
  }

  // ============================================================
  // 承: K8s Cleanup and KMS Grants
  // ============================================================

  /**
   * Execute K8s cleanup automatically via SSM Run Command.
   * Falls back to showing manual instructions if SSM fails.
   */
  private async executeK8sCleanup(ctx: DestroyContext): Promise<{ automated: boolean; success: boolean }> {
    if (!ctx.bastionId) {
      log.warn('Bastion not found - skipping K8s cleanup');
      return { automated: false, success: false };
    }

    // Check SSM agent status
    const ssmStatus = ssmGetInstanceStatus(ctx.bastionId, ctx.region);
    if (ssmStatus.status !== 'Online') {
      log.warn(`SSM agent not online (status: ${ssmStatus.status}). Falling back to manual instructions.`);
      this.showK8sCleanupInstructions(ctx);
      return { automated: false, success: false };
    }

    if (ctx.dryRun) {
      log.dryRun('Would execute K8s cleanup via SSM');
      return { automated: true, success: true };
    }

    log.info('Executing K8s cleanup via SSM Run Command...');

    const kubeconfigPath = '/tmp/.kube/config';
    const cleanupScript = `
set -e
export PATH=/usr/local/bin:$PATH
export HOME=/root
export KUBECONFIG=${kubeconfigPath}

# Setup kubeconfig
mkdir -p /tmp/.kube
aws eks update-kubeconfig --region ${ctx.region} --name ${ctx.clusterName} --kubeconfig ${kubeconfigPath} 2>/dev/null

echo "=== Checking LoadBalancer services ==="
kubectl get svc -A -o json 2>/dev/null | jq -r '.items[] | select(.spec.type=="LoadBalancer") | "  " + .metadata.namespace + "/" + .metadata.name' || echo "  None found"

echo ""
echo "=== Deleting app namespace ==="
kubectl delete namespace app --ignore-not-found --timeout=120s 2>/dev/null || echo "  Namespace app not found or already deleted"

echo ""
echo "=== Uninstalling ALB Controller ==="
helm uninstall aws-load-balancer-controller -n kube-system --ignore-not-found --wait 2>/dev/null || echo "  ALB Controller not installed or already uninstalled"

echo ""
echo "=== Uninstalling Karpenter ==="
helm uninstall karpenter -n karpenter --ignore-not-found --wait 2>/dev/null || echo "  Karpenter not installed or already uninstalled"
kubectl delete namespace karpenter --ignore-not-found --timeout=60s 2>/dev/null || true

echo ""
echo "=== Deleting all PVCs ==="
kubectl delete pvc --all -A --timeout=60s 2>/dev/null || echo "  No PVCs found or already deleted"

echo ""
echo "=== Verifying no LoadBalancer services remain ==="
LB_COUNT=$(kubectl get svc -A -o json 2>/dev/null | jq '[.items[] | select(.spec.type=="LoadBalancer")] | length')
if [ "$LB_COUNT" -gt 0 ]; then
  echo "  WARNING: $LB_COUNT LoadBalancer service(s) still exist"
  kubectl get svc -A | grep LoadBalancer || true
else
  echo "  OK: No LoadBalancer services remaining"
fi

echo ""
echo "=== K8s cleanup completed ==="
`.trim();

    try {
      const ssm = new SSMCommandRunner(ctx.bastionId, ctx.region);
      const result = await ssm.execute(cleanupScript, {
        timeout: 300, // 5 minutes for cleanup operations
        label: 'K8s Cleanup',
        stream: true,
      });

      if (result.success) {
        log.pass('K8s cleanup completed successfully');
        return { automated: true, success: true };
      } else {
        log.warn(`K8s cleanup had issues: ${result.error || result.status}`);
        log.info('You may need to verify cleanup manually on bastion.');
        return { automated: true, success: false };
      }
    } catch (error) {
      log.warn(`SSM execution failed: ${toError(error).message}`);
      log.info('Falling back to manual instructions...');
      this.showK8sCleanupInstructions(ctx);
      return { automated: false, success: false };
    }
  }

  private showK8sCleanupInstructions(ctx: DestroyContext): boolean {
    if (!ctx.bastionId) {
      log.warn('Bastion not found - skipping K8s cleanup');
      return false;
    }

    const commands = [
      ['Delete app namespace', 'kubectl delete namespace app --ignore-not-found'],
      ['Uninstall ALB Controller', 'helm uninstall aws-load-balancer-controller -n kube-system --ignore-not-found'],
      ['Uninstall Karpenter', 'helm uninstall karpenter -n karpenter --ignore-not-found && kubectl delete namespace karpenter --ignore-not-found'],
      ['Delete all PVCs', 'kubectl delete pvc --all -A'],
      ['Verify no LoadBalancer services', 'kubectl get svc -A | grep LoadBalancer'],
    ];

    log.info('K8s cleanup requires manual execution on bastion:');
    console.log('');
    for (const [desc, cmd] of commands) {
      console.log(`# ${desc}`);
      console.log(cmd);
      console.log('');
    }

    return true;
  }

  private async cleanupKmsGrants(ctx: DestroyContext): Promise<void> {
    const aliasResult = aws(
      `kms list-aliases --query 'Aliases[?contains(AliasName, \`eks\`) || contains(AliasName, \`${ctx.clusterName}\`)]' --output json`,
      { ignoreError: true, region: ctx.region }
    );
    if (!aliasResult) {
      log.info('No EKS KMS aliases found');
      return;
    }

    let aliases: Array<{ AliasName: string; TargetKeyId?: string }> = [];
    try {
      aliases = JSON.parse(aliasResult);
    } catch {
      return;
    }

    for (const alias of aliases) {
      if (!alias.TargetKeyId) continue;

      const keyId = alias.TargetKeyId;
      log.info(`Checking grants for key: ${alias.AliasName}`);

      const grantsResult = aws(`kms list-grants --key-id ${keyId} --output json`, { ignoreError: true, region: ctx.region });
      if (!grantsResult) continue;

      let grantsData: { Grants?: KmsGrant[] } = {};
      try {
        grantsData = JSON.parse(grantsResult);
      } catch {
        continue;
      }

      const grants = grantsData.Grants || [];
      if (grants.length === 0) continue;

      log.info(`  Found ${grants.length} grant(s)`);

      for (const grant of grants) {
        if (ctx.dryRun) {
          log.dryRun(`Would revoke grant: ${grant.GrantId}`);
        } else {
          aws(`kms revoke-grant --key-id ${keyId} --grant-id ${grant.GrantId}`, { ignoreError: true, region: ctx.region });
          log.pass(`Revoked grant: ${grant.GrantId.substring(0, 20)}...`);
        }
      }
    }
  }

  // ============================================================
  // 転: AWS Resource Cleanup
  // ============================================================

  private async cleanupAlbs(ctx: DestroyContext): Promise<CleanerResult> {
    const cleaner = createResourceCleaner<ALBResponse>({
      name: 'ALB',
      list: async () => {
        const result = aws(`elbv2 describe-load-balancers --query 'LoadBalancers[*]' --output json`, { ignoreError: true, region: ctx.region });
        const albs = result ? safeParseJson(result, ALBListSchema) ?? [] : [];
        return albs.filter((a) => (!ctx.vpcId || a.VpcId === ctx.vpcId) && this.matchesProject(a.LoadBalancerName, ctx.clusterName));
      },
      delete: async (alb) => { aws(`elbv2 delete-load-balancer --load-balancer-arn "${alb.LoadBalancerArn}"`, { region: ctx.region }); },
      checkDeleted: async (alb) => {
        const res = aws(`elbv2 describe-load-balancers --load-balancer-arns "${alb.LoadBalancerArn}" --output text`, { ignoreError: true, region: ctx.region });
        return !res;
      },
      getId: (alb) => alb.LoadBalancerName,
      waitAfterAll: 5000,
    }, ctx.cleanerConfig);

    return cleaner.run();
  }

  private async cleanupTargetGroups(ctx: DestroyContext): Promise<CleanerResult> {
    const cleaner = createResourceCleaner<TargetGroupResponse>({
      name: 'Target Group',
      list: async () => {
        const result = aws(`elbv2 describe-target-groups --query 'TargetGroups[*]' --output json`, { ignoreError: true, region: ctx.region });
        const tgs = result ? safeParseJson(result, TargetGroupListSchema) ?? [] : [];
        return tgs.filter((t) => (!ctx.vpcId || t.VpcId === ctx.vpcId) && this.matchesProject(t.TargetGroupName, ctx.clusterName));
      },
      delete: async (tg) => { aws(`elbv2 delete-target-group --target-group-arn "${tg.TargetGroupArn}"`, { region: ctx.region }); },
      getId: (tg) => tg.TargetGroupName,
    }, ctx.cleanerConfig);

    return cleaner.run();
  }

  private async cleanupNodeGroups(ctx: DestroyContext): Promise<CleanerResult> {
    const cleaner = createResourceCleaner<string>({
      name: 'Node Group',
      list: async () => eksListNodeGroups(ctx.clusterName, ctx.region),
      delete: async (name) => { aws(`eks delete-nodegroup --cluster-name ${ctx.clusterName} --nodegroup-name ${name}`, { region: ctx.region }); },
      checkDeleted: async (name) => {
        const status = aws(`eks describe-nodegroup --cluster-name ${ctx.clusterName} --nodegroup-name ${name} --query 'nodegroup.status' --output text`, { ignoreError: true, region: ctx.region });
        return !status || status === 'None';
      },
      getId: (name) => name,
    }, ctx.cleanerConfig);

    return cleaner.run();
  }

  private async cleanupKarpenterNodes(ctx: DestroyContext): Promise<CleanerResult> {
    const cleaner = createResourceCleaner<KarpenterNodeResponse>({
      name: 'Karpenter Node',
      list: async () => {
        // Find EC2 instances with karpenter.sh/* tags (Karpenter-provisioned nodes)
        const result = aws(
          `ec2 describe-instances --filters "Name=tag-key,Values=karpenter.sh/*" "Name=instance-state-name,Values=running,pending,stopping,stopped,shutting-down" --query 'Reservations[*].Instances[*]' --output json`,
          { ignoreError: true, region: ctx.region }
        );
        if (!result) return [];
        const parsed = safeParseJson(result, KarpenterNodeListSchema.optional());
        // Flatten nested array (Reservations[*].Instances[*])
        const instances: KarpenterNodeResponse[] = [];
        try {
          const raw = JSON.parse(result) as KarpenterNodeResponse[][];
          for (const reservation of raw) {
            instances.push(...reservation);
          }
        } catch {
          return parsed ?? [];
        }
        return instances.filter(i => i.State?.Name !== 'terminated');
      },
      delete: async (instance) => {
        aws(`ec2 terminate-instances --instance-ids ${instance.InstanceId}`, { region: ctx.region });
      },
      checkDeleted: async (instance) => {
        const state = aws(
          `ec2 describe-instances --instance-ids ${instance.InstanceId} --query 'Reservations[0].Instances[0].State.Name' --output text`,
          { ignoreError: true, region: ctx.region }
        );
        return !state || state === 'terminated' || state === 'None';
      },
      getId: (instance) => `${instance.InstanceId} (${instance.InstanceType || 'unknown'})`,
      waitAfterAll: 30000, // Wait 30s for ENIs to be released
    }, ctx.cleanerConfig);

    return cleaner.run();
  }

  private async cleanupVpcEndpoints(ctx: DestroyContext): Promise<CleanerResult> {
    const cleaner = createResourceCleaner<VpcEndpointResponse>({
      name: 'VPC Endpoint',
      list: async () => {
        if (!ctx.vpcId) return [];
        const result = aws(`ec2 describe-vpc-endpoints --filters "Name=vpc-id,Values=${ctx.vpcId}" --query 'VpcEndpoints[?VpcEndpointType==\`Interface\`]' --output json`, { ignoreError: true, region: ctx.region });
        return result ? safeParseJson(result, VpcEndpointListSchema) ?? [] : [];
      },
      delete: async (ep) => { aws(`ec2 delete-vpc-endpoints --vpc-endpoint-ids ${ep.VpcEndpointId}`, { region: ctx.region }); },
      getId: (ep) => `${ep.VpcEndpointId} (${ep.ServiceName.split('.').pop()})`,
      waitAfterAll: 30000,
    }, ctx.cleanerConfig);

    return cleaner.run();
  }

  private async cleanupNatGateways(ctx: DestroyContext): Promise<CleanerResult> {
    const cleaner = createResourceCleaner<NatGatewayResponse>({
      name: 'NAT Gateway',
      list: async () => {
        if (!ctx.vpcId) return [];
        const result = aws(`ec2 describe-nat-gateways --filter "Name=vpc-id,Values=${ctx.vpcId}" "Name=state,Values=available,pending" --query 'NatGateways[*]' --output json`, { ignoreError: true, region: ctx.region });
        return result ? safeParseJson(result, NatGatewayListSchema) ?? [] : [];
      },
      delete: async (nat) => { aws(`ec2 delete-nat-gateway --nat-gateway-id ${nat.NatGatewayId}`, { region: ctx.region }); },
      checkDeleted: async (nat) => {
        const state = aws(`ec2 describe-nat-gateways --nat-gateway-ids ${nat.NatGatewayId} --query 'NatGateways[0].State' --output text`, { ignoreError: true, region: ctx.region });
        return !state || state === 'deleted' || state === 'None';
      },
      getId: (nat) => nat.NatGatewayId,
    }, ctx.cleanerConfig);

    return cleaner.run();
  }

  private async cleanupEips(ctx: DestroyContext): Promise<CleanerResult> {
    const cleaner = createResourceCleaner<ElasticIPResponse>({
      name: 'Elastic IP',
      list: async () => {
        const result = aws(`ec2 describe-addresses --query 'Addresses[?AssociationId==null]' --output json`, { ignoreError: true, region: ctx.region });
        const eips = result ? safeParseJson(result, ElasticIPListSchema) ?? [] : [];
        return eips.filter((e) => {
          const tag = e.Tags?.find((t) => t.Key === 'Project');
          return !tag || tag.Value === ctx.clusterName;
        });
      },
      delete: async (eip) => { aws(`ec2 release-address --allocation-id ${eip.AllocationId}`, { region: ctx.region }); },
      getId: (eip) => eip.PublicIp,
    }, ctx.cleanerConfig);

    return cleaner.run();
  }

  private async cleanupEnis(ctx: DestroyContext): Promise<CleanerResult> {
    const cleaner = createResourceCleaner<NetworkInterfaceResponse>({
      name: 'ENI',
      list: async () => {
        if (!ctx.vpcId) return [];
        const result = aws(`ec2 describe-network-interfaces --filters "Name=vpc-id,Values=${ctx.vpcId}" "Name=status,Values=available" --query 'NetworkInterfaces[*]' --output json`, { ignoreError: true, region: ctx.region });
        return result ? safeParseJson(result, NetworkInterfaceListSchema) ?? [] : [];
      },
      delete: async (eni) => { aws(`ec2 delete-network-interface --network-interface-id ${eni.NetworkInterfaceId}`, { region: ctx.region }); },
      getId: (eni) => `${eni.NetworkInterfaceId} (${eni.Description || 'no desc'})`,
    }, ctx.cleanerConfig);

    return cleaner.run();
  }

  private async cleanupEbsVolumes(ctx: DestroyContext): Promise<CleanerResult> {
    const cleaner = createResourceCleaner<EBSVolumeResponse>({
      name: 'EBS Volume',
      list: async () => {
        const result = aws(`ec2 describe-volumes --filters "Name=status,Values=available" --query 'Volumes[*]' --output json`, { ignoreError: true, region: ctx.region });
        const volumes = result ? safeParseJson(result, EBSVolumeListSchema) ?? [] : [];
        return volumes.filter((v) => {
          const projectTag = v.Tags?.find((t) => t.Key === 'Project');
          if (projectTag && projectTag.Value === ctx.clusterName) return true;
          const k8sTag = v.Tags?.find((t) => t.Key.startsWith('kubernetes.io/'));
          return !!k8sTag;
        });
      },
      delete: async (vol) => { aws(`ec2 delete-volume --volume-id ${vol.VolumeId}`, { region: ctx.region }); },
      checkDeleted: async (vol) => {
        const state = aws(`ec2 describe-volumes --volume-ids ${vol.VolumeId} --query 'Volumes[0].State' --output text`, { ignoreError: true, region: ctx.region });
        return !state || state === 'None' || state === 'deleted';
      },
      getId: (vol) => `${vol.VolumeId} (${vol.Size}GiB)`,
    }, ctx.cleanerConfig);

    return cleaner.run();
  }

  private async cleanupSecurityGroups(ctx: DestroyContext): Promise<CleanerResult> {
    const removeRules = async (sgId: string): Promise<void> => {
      const rulesJson = aws(`ec2 describe-security-group-rules --filters "Name=group-id,Values=${sgId}" --query 'SecurityGroupRules[?ReferencedGroupInfo.GroupId!=null]' --output json`, { ignoreError: true, region: ctx.region });
      const rules = rulesJson ? safeParseJson(rulesJson, SecurityGroupRuleListSchema) ?? [] : [];
      for (const rule of rules) {
        const cmd = rule.IsEgress ? 'revoke-security-group-egress' : 'revoke-security-group-ingress';
        aws(`ec2 ${cmd} --group-id ${sgId} --security-group-rule-ids ${rule.SecurityGroupRuleId}`, { ignoreError: true, region: ctx.region });
      }
    };

    const cleaner = createResourceCleaner<SecurityGroupResponse>({
      name: 'Security Group',
      list: async () => {
        if (!ctx.vpcId) return [];
        const result = aws(`ec2 describe-security-groups --filters "Name=vpc-id,Values=${ctx.vpcId}" --query 'SecurityGroups[?GroupName!=\`default\`]' --output json`, { ignoreError: true, region: ctx.region });
        const sgs = result ? safeParseJson(result, SecurityGroupListSchema) ?? [] : [];
        return sgs.sort((a, b) => {
          const aK8s = a.GroupName.startsWith('k8s-');
          const bK8s = b.GroupName.startsWith('k8s-');
          return aK8s === bK8s ? 0 : aK8s ? -1 : 1;
        });
      },
      preDelete: async (sg) => {
        if (!ctx.dryRun) await removeRules(sg.GroupId);
      },
      delete: async (sg) => { aws(`ec2 delete-security-group --group-id ${sg.GroupId}`, { region: ctx.region }); },
      getId: (sg) => `${sg.GroupId} (${sg.GroupName})`,
    }, ctx.cleanerConfig);

    return cleaner.run();
  }

  /**
   * Execute a cleanup group - runs tasks in parallel or sequentially based on group config.
   * Uses Promise.allSettled to allow partial failures without blocking other tasks.
   */
  private async executeCleanupGroup(group: ParallelCleanupGroup): Promise<Record<string, CleanerResult>> {
    const results: Record<string, CleanerResult> = {};

    if (group.sequential) {
      // Sequential execution within group
      for (const task of group.tasks) {
        try {
          log.info(`  → ${task.name}...`);
          results[task.name] = await task.fn();
        } catch (e: unknown) {
          const error = e as Error;
          log.warn(`  ⚠ ${task.name} failed: ${error.message}`);
          results[task.name] = { found: 0, deleted: 0, success: false, errors: [error.message] };
        }
      }
    } else {
      // Parallel execution within group
      log.info(`  Running ${group.tasks.length} tasks in parallel...`);
      const taskPromises = group.tasks.map(async (task) => {
        try {
          const result = await task.fn();
          return { name: task.name, result, success: true as const };
        } catch (e: unknown) {
          const error = e as Error;
          return {
            name: task.name,
            result: { found: 0, deleted: 0, success: false, errors: [error.message] } as CleanerResult,
            success: false as const,
          };
        }
      });

      const settled = await Promise.allSettled(taskPromises);

      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          const { name, result, success } = outcome.value;
          results[name] = result;
          if (success) {
            log.pass(`  ✓ ${name}: ${result.deleted} deleted`);
          } else {
            log.warn(`  ⚠ ${name}: failed`);
          }
        } else {
          // This shouldn't happen since we catch errors above, but handle it anyway
          log.warn(`  ⚠ Task rejected: ${outcome.reason}`);
        }
      }
    }

    return results;
  }

  /**
   * Cleanup Security Groups with retry logic.
   * Called after Terraform destroy to ensure all SGs can be deleted.
   */
  private async cleanupSecurityGroupsWithRetry(ctx: DestroyContext): Promise<CleanerResult> {
    const maxRetries = 3;
    const retryDelayMs = 5000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.cleanupSecurityGroups(ctx);

      // All deleted successfully or nothing to delete
      if (result.found === 0 || result.deleted === result.found) {
        return result;
      }

      // Retry if not the last attempt
      if (attempt < maxRetries) {
        log.info(`Retrying Security Group cleanup (${attempt}/${maxRetries})...`);
        await this.sleep(retryDelayMs);
      }
    }

    // Return final result
    return this.cleanupSecurityGroups(ctx);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async cleanupS3Buckets(ctx: DestroyContext): Promise<CleanerResult> {
    const emptyBucket = async (name: string): Promise<void> => {
      aws(`s3 rm s3://${name} --recursive`, { ignoreError: true, timeout: 300000, region: ctx.region });
      for (const key of ['Versions', 'DeleteMarkers']) {
        const result = aws(`s3api list-object-versions --bucket ${name} --query '${key}[].{Key:Key,VersionId:VersionId}' --output json`, { ignoreError: true, region: ctx.region });
        const items = result ? safeParseJson(result, S3ObjectVersionListSchema) ?? [] : [];
        for (const item of items.slice(0, 100)) {
          aws(`s3api delete-object --bucket ${name} --key "${item.Key}" --version-id "${item.VersionId}"`, { ignoreError: true, region: ctx.region });
        }
      }
    };

    const cleaner = createResourceCleaner<string>({
      name: 'S3 Bucket',
      list: async () => {
        const name = this.tfOutput('s3_bucket_name', ctx.tfDir);
        return name ? [name] : [];
      },
      delete: async (name) => { await emptyBucket(name); },
      getId: (name) => name,
    }, ctx.cleanerConfig);

    return cleaner.run();
  }

  private async cleanupLogGroups(ctx: DestroyContext): Promise<CleanerResult> {
    const patterns = [
      '/k8s-ml-platform/prod/vpc-flow-logs',
      '/k8s-ml-platform/prod/app-errors',
      `/aws/eks/${ctx.clusterName}/cluster`,
    ];

    const cleaner = createResourceCleaner<string>({
      name: 'CloudWatch Log Group',
      list: async () => {
        const groups: string[] = [];
        for (const p of patterns) {
          const result = aws(`logs describe-log-groups --log-group-name-prefix "${p}" --query 'logGroups[*].logGroupName' --output json`, { ignoreError: true, region: ctx.region });
          groups.push(...(result ? safeParseJson(result, StringArraySchema) ?? [] : []));
        }
        return groups;
      },
      delete: async (name) => { aws(`logs delete-log-group --log-group-name "${name}"`, { region: ctx.region }); },
      getId: (name) => name,
    }, ctx.cleanerConfig);

    return cleaner.run();
  }

  // ============================================================
  // 結: Terraform Destroy
  // ============================================================

  private async runTerraformDestroy(ctx: DestroyContext): Promise<boolean> {
    if (ctx.dryRun) {
      log.dryRun('Would run: terraform destroy');
      return false;
    }

    try {
      log.info('Running terraform destroy...');
      await runStreaming('terraform', ['destroy', '-auto-approve'], ctx.tfDir);
      log.pass('Terraform destroy completed');
      return true;
    } catch (e: unknown) {
      log.fail(`Terraform destroy failed: ${toError(e).message}`);
      throw e;
    }
  }
}
