/**
 * QueryClusterStatus UseCase
 *
 * Queries the status of the EKS cluster and related AWS resources.
 * This is a read-only query (起のみ) following the 起承転結 narrative.
 */

import type { InfraContainer } from '../../container/types.js';
import { UseCase, type UseCaseResult } from '../base/UseCase.js';
import { aws, run } from '../../infrastructure/shell/index.js';
import { eksGetClusterStatus, eksGetClusterVersion, eksListNodeGroups, eksDescribeNodeGroup } from '../../infrastructure/aws/api/eks.js';

/**
 * Input for cluster status query.
 */
export interface QueryClusterStatusInput {
  /** AWS region */
  region: string;
  /** Cluster name (defaults to 'prod-eks-cluster') */
  clusterName?: string;
  /** Terraform directory */
  tfDir: string;
}

/**
 * Node group status info.
 */
export interface NodeGroupStatus {
  name: string;
  status: string;
  desiredSize?: number;
}

/**
 * VPC status info.
 */
export interface VpcStatus {
  id: string;
  state: string;
  cidr: string;
}

/**
 * NAT Gateway status info.
 */
export interface NatGatewayStatus {
  id: string;
  state: string;
}

/**
 * ALB status info.
 */
export interface AlbStatus {
  name: string;
  state: string;
  dnsName?: string;
}

/**
 * Lambda status info.
 */
export interface LambdaStatus {
  name: string;
  state: string;
  runtime?: string;
}

/**
 * Output from cluster status query.
 */
export interface QueryClusterStatusOutput {
  /** AWS account ID */
  accountId?: string;
  /** Cluster info */
  cluster: {
    name: string;
    status: string;
    version?: string;
    endpoint?: string;
  };
  /** Node groups */
  nodeGroups: NodeGroupStatus[];
  /** VPC info */
  vpc?: VpcStatus;
  /** NAT Gateway info */
  natGateway?: NatGatewayStatus;
  /** ALB info */
  alb?: AlbStatus;
  /** Lambda info */
  lambda?: LambdaStatus;
  /** Terraform state info */
  terraform: {
    resourceCount: number;
  };
  /** Whether terraform is currently running */
  terraformRunning: boolean;
  /** Summary of readiness */
  ready: {
    vpc: boolean;
    natGateway: boolean;
    cluster: boolean;
  };
}

/**
 * Queries the status of all cluster-related resources.
 */
export class QueryClusterStatus extends UseCase<QueryClusterStatusInput, QueryClusterStatusOutput> {
  constructor(container: InfraContainer) {
    super(container);
  }

  async execute(input: QueryClusterStatusInput): Promise<UseCaseResult<QueryClusterStatusOutput>> {
    this.startTimer();

    const clusterName = input.clusterName || 'prod-eks-cluster';
    let accountId: string | undefined;
    let clusterStatus = 'NOT_FOUND';
    let clusterVersion: string | undefined;
    let clusterEndpoint: string | undefined;
    const nodeGroups: NodeGroupStatus[] = [];
    let vpc: VpcStatus | undefined;
    let natGateway: NatGatewayStatus | undefined;
    let alb: AlbStatus | undefined;
    let lambda: LambdaStatus | undefined;
    let terraformResourceCount = 0;
    let terraformRunning = false;

    try {
      // 起: Query all resources
      await this.runPhase('setup', 'AWS Account', 'Getting AWS account info', async () => {
        accountId = run('aws sts get-caller-identity --query Account --output text', { ignoreError: true }) || undefined;
      });

      await this.runPhase('setup', 'EKS Cluster', 'Getting cluster status', async () => {
        clusterStatus = eksGetClusterStatus(clusterName, input.region);
        if (clusterStatus !== 'NOT_FOUND') {
          clusterVersion = eksGetClusterVersion(clusterName, input.region) || undefined;
          const endpoint = aws(
            `eks describe-cluster --name ${clusterName} --query 'cluster.endpoint' --output text`,
            { ignoreError: true, region: input.region }
          );
          clusterEndpoint = endpoint || undefined;
        }
      });

      await this.runPhase('setup', 'Node Groups', 'Getting node group status', async () => {
        if (clusterStatus !== 'NOT_FOUND') {
          const ngNames = eksListNodeGroups(clusterName, input.region);
          for (const ng of ngNames) {
            const ngInfo = eksDescribeNodeGroup(clusterName, ng, input.region);
            if (ngInfo) {
              nodeGroups.push({
                name: ng,
                status: ngInfo.status || 'UNKNOWN',
                desiredSize: ngInfo.desiredSize,
              });
            }
          }
        }
      });

      await this.runPhase('setup', 'VPC', 'Getting VPC status', async () => {
        const vpcsJson = aws(
          `ec2 describe-vpcs --filters "Name=tag:Name,Values=*k8s-ml-platform*" --query 'Vpcs[].{VpcId:VpcId,State:State,CidrBlock:CidrBlock}' --output json`,
          { ignoreError: true, region: input.region }
        );
        if (vpcsJson) {
          try {
            const vpcList = JSON.parse(vpcsJson) as Array<{ VpcId: string; State: string; CidrBlock: string }>;
            if (vpcList.length > 0) {
              vpc = {
                id: vpcList[0].VpcId,
                state: vpcList[0].State,
                cidr: vpcList[0].CidrBlock,
              };
            }
          } catch { /* ignore */ }
        }
      });

      await this.runPhase('setup', 'NAT Gateway', 'Getting NAT Gateway status', async () => {
        const natsJson = aws(
          `ec2 describe-nat-gateways --filter "Name=tag:Name,Values=*k8s-ml-platform*" --query 'NatGateways[].{NatGatewayId:NatGatewayId,State:State}' --output json`,
          { ignoreError: true, region: input.region }
        );
        if (natsJson) {
          try {
            const nats = JSON.parse(natsJson) as Array<{ NatGatewayId: string; State: string }>;
            if (nats.length > 0) {
              natGateway = {
                id: nats[0].NatGatewayId,
                state: nats[0].State,
              };
            }
          } catch { /* ignore */ }
        }
      });

      await this.runPhase('setup', 'Load Balancer', 'Getting ALB status', async () => {
        const albsJson = aws(
          `elbv2 describe-load-balancers --query "LoadBalancers[?contains(LoadBalancerName, 'k8s-ml-platform')].{Name:LoadBalancerName,State:State.Code,DNSName:DNSName}" --output json`,
          { ignoreError: true, region: input.region }
        );
        if (albsJson) {
          try {
            const albList = JSON.parse(albsJson) as Array<{ Name: string; State: string; DNSName?: string }>;
            if (albList.length > 0) {
              alb = {
                name: albList[0].Name,
                state: albList[0].State,
                dnsName: albList[0].DNSName,
              };
            }
          } catch { /* ignore */ }
        }
      });

      await this.runPhase('setup', 'Lambda', 'Getting Lambda status', async () => {
        const lambdaName = 'k8s-ml-platform-prod-auth-gw';
        const lambdaJson = aws(
          `lambda get-function --function-name ${lambdaName} --query 'Configuration.{State:State,Runtime:Runtime}' --output json`,
          { ignoreError: true, region: input.region }
        );
        if (lambdaJson) {
          try {
            const lambdaInfo = JSON.parse(lambdaJson) as { State: string; Runtime: string };
            lambda = {
              name: lambdaName,
              state: lambdaInfo.State,
              runtime: lambdaInfo.Runtime,
            };
          } catch { /* ignore */ }
        }
      });

      await this.runPhase('setup', 'Terraform State', 'Getting Terraform state', async () => {
        const stateList = run(`terraform state list`, { cwd: input.tfDir, ignoreError: true });
        terraformResourceCount = stateList ? stateList.split('\n').filter(Boolean).length : 0;
      });

      await this.runPhase('setup', 'Running Processes', 'Checking for running Terraform', async () => {
        const tfProcesses = run('ps aux | grep -E "terraform (apply|plan)" | grep -v grep | wc -l', { ignoreError: true });
        terraformRunning = parseInt(tfProcesses || '0') > 0;
      });

      // Build output
      const output: QueryClusterStatusOutput = {
        accountId,
        cluster: {
          name: clusterName,
          status: clusterStatus,
          version: clusterVersion,
          endpoint: clusterEndpoint,
        },
        nodeGroups,
        vpc,
        natGateway,
        alb,
        lambda,
        terraform: {
          resourceCount: terraformResourceCount,
        },
        terraformRunning,
        ready: {
          vpc: vpc?.state === 'available',
          natGateway: natGateway?.state === 'available',
          cluster: clusterStatus === 'ACTIVE',
        },
      };

      return this.buildResult(output);
    } catch (error) {
      if (error instanceof Error) {
        return this.buildFailedResult(error);
      }
      return this.buildFailedResult(new Error(String(error)));
    }
  }
}
