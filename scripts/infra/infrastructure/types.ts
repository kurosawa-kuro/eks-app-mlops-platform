/**
 * Boundary Type Definitions
 *
 * This file defines types for boundaries between Node.js and external systems:
 * - Shell Process (run, aws commands)
 * - AWS CLI stdout
 * - File system
 *
 * =============================================================================
 * FILE STRUCTURE
 * =============================================================================
 *
 * infrastructure/types.ts (this file) - External boundary types & Zod schemas
 * framework/types.ts                  - Internal framework types (UI, CLI, Poller, etc.)
 *
 * =============================================================================
 * OPERATIONAL RULES
 * =============================================================================
 *
 * 1. SCOPE: External boundaries only
 *    - AWS CLI responses
 *    - Terraform outputs
 *    - JSON file parsing
 *
 * 2. PROHIBITED: Project-specific business logic
 *    - No domain models
 *    - No application state types
 *    - No UI/presentation types → use framework/types.ts
 *
 * 3. SCHEMA ADDITIONS: Read/Destroy operations only
 *    - describe-*, list-*, get-* responses: OK
 *    - delete-*, destroy-* responses: OK
 *    - create-*, put-*, update-* responses: Minimal (ARN/Name only)
 *
 * =============================================================================
 */

import { z } from 'zod';

// ============================================================
// BOUNDARY: Shell Process
// ============================================================

export interface RunOptions {
  cwd?: string;
  silent?: boolean;
  ignoreError?: boolean;
  throwOnError?: boolean;
  timeout?: number;
  env?: Record<string, string>;
  region?: string;  // for aws() wrapper
}

export interface RunResult {
  success: boolean;
  output: string;
  stderr?: string;
  error?: Error;
}

// ============================================================
// BOUNDARY: Streaming Process
// ============================================================

export interface StreamingResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface StreamingOptions {
  shell?: boolean;
  /** Timeout in milliseconds. Process will be killed if exceeded. */
  timeout?: number;
}

// ============================================================
// Terraform Outputs
// ============================================================

export interface TerraformOutputs {
  get: (key: string) => string | null;
  s3Bucket: () => string | undefined;
  apiUrl: () => string | undefined;
  bastionId: () => string | null;
  lbRoleArn: () => string | null;
  vpcId: () => string | null;
  clusterName: () => string | null;
  clusterEndpoint: () => string | null;
  karpenterRoleArn: () => string | null;
  karpenterQueueName: () => string | null;
  workloadRoleArn: () => string | null;
  ecrMlopsUrl: () => string | null;
}

// ============================================================
// S3 Bucket Info
// ============================================================

export interface S3BucketInfo {
  name: string;
  region?: string;
  versioning?: string;
  encryption?: string;
}

// ============================================================
// EKS Cluster Info
// ============================================================

export interface EKSClusterInfo {
  cluster: {
    name: string;
    arn: string;
    endpoint?: string;
    status: string;
  };
}

// ============================================================
// Secrets Manager Info
// ============================================================

export interface SecretInfo {
  Name: string;
  ARN?: string;
  Description?: string;
  CreatedDate?: string;
  LastChangedDate?: string;
}

// ============================================================
// ECR Repository Info
// ============================================================

export interface ECRRepositoryResult {
  repository?: {
    repositoryName: string;
    repositoryUri: string;
    repositoryArn: string;
  };
}

export interface ECRImage {
  imageTags?: string[];
  imageDigest?: string;
  imageSizeInBytes?: number;
  imagePushedAt?: string;
}

// ============================================================
// EC2 Instance Info
// ============================================================

export interface EC2Instance {
  InstanceId: string;
  InstanceType?: string;
  State?: {
    Name: string;
    Code?: number;
  };
  PrivateIpAddress?: string;
  PublicIpAddress?: string;
  LaunchTime?: string;
  Tags?: Array<{ Key: string; Value: string }>;
  Placement?: {
    AvailabilityZone?: string;
  };
  PlatformDetails?: string;
}

export interface EC2DescribeInstancesResult {
  Reservations?: Array<{
    Instances?: EC2Instance[];
  }>;
}

// ============================================================
// EKS Cluster/NodeGroup Info
// ============================================================

export interface EKSCluster {
  name: string;
  arn?: string;
  status?: string;
  version?: string;
  endpoint?: string;
  createdAt?: string;
  platformVersion?: string;
  resourcesVpcConfig?: {
    vpcId?: string;
    subnetIds?: string[];
    endpointPublicAccess?: boolean;
    endpointPrivateAccess?: boolean;
  };
}

export interface EKSNodeGroup {
  nodegroupName?: string;
  nodegroupArn?: string;
  status?: string;
  capacityType?: string;
  scalingConfig?: {
    minSize?: number;
    maxSize?: number;
    desiredSize?: number;
  };
  instanceTypes?: string[];
  amiType?: string;
  createdAt?: string;
}

export interface EKSListClustersResult {
  clusters?: string[];
}

export interface EKSDescribeClusterResult {
  cluster?: EKSCluster;
}

export interface EKSListNodeGroupsResult {
  nodegroups?: string[];
}

export interface EKSDescribeNodeGroupResult {
  nodegroup?: EKSNodeGroup;
}

/** Extended node group info for tf-deploy and monitoring */
export interface EKSNodeGroupInfo {
  name: string;
  status: string;
  desiredSize?: number;
  asgName?: string;
  healthIssues: Array<{ code: string; message: string }>;
}

/** EC2 instance info for tf-deploy and monitoring */
export interface EC2InstanceInfo {
  state?: string;
  imageId?: string;
  instanceType?: string;
  privateIp?: string;
}

/** ASG instance info for tf-deploy and monitoring */
export interface ASGInstance {
  instanceId: string;
  lifecycleState: string;
  healthStatus: string;
}

// ============================================================
// Error Handling Utilities
// ============================================================

/**
 * Safely extract Error from unknown catch value.
 * Use this instead of `e as Error` in catch blocks.
 */
export function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (typeof e === 'string') return new Error(e);
  if (e && typeof e === 'object' && 'message' in e) {
    return new Error(String((e as { message: unknown }).message));
  }
  return new Error(String(e));
}

// ============================================================
// Zod Schemas for AWS CLI Responses (Runtime Validation)
// ============================================================

/** EKS list-nodegroups response */
export const EKSListNodeGroupsSchema = z.object({
  nodegroups: z.array(z.string()).optional(),
});

/** EKS describe-nodegroup response */
export const EKSDescribeNodeGroupSchema = z.object({
  nodegroup: z.object({
    nodegroupName: z.string(),
    status: z.string(),
    scalingConfig: z.object({
      desiredSize: z.number().optional(),
    }).optional(),
    resources: z.object({
      autoScalingGroups: z.array(z.object({
        name: z.string(),
      })).optional(),
    }).optional(),
    health: z.object({
      issues: z.array(z.object({
        code: z.string(),
        message: z.string(),
      })).optional(),
    }).optional(),
  }).optional(),
});

/** ASG instances from describe-auto-scaling-groups */
export const ASGInstancesSchema = z.array(z.object({
  InstanceId: z.string(),
  LifecycleState: z.string(),
  HealthStatus: z.string(),
}));

/** EC2 instance from describe-instances */
export const EC2InstanceQuerySchema = z.object({
  State: z.object({
    Name: z.string(),
  }).optional(),
  ImageId: z.string().optional(),
  InstanceType: z.string().optional(),
  PrivateIpAddress: z.string().optional(),
});

/** EC2 AMI from describe-images */
export const EC2AMISchema = z.object({
  Name: z.string().optional(),
});

/** SSM instance information */
export const SSMInstanceInfoSchema = z.object({
  InstanceInformationList: z.array(z.object({
    PingStatus: z.string().optional(),
    LastPingDateTime: z.string().optional(),
    AgentVersion: z.string().optional(),
    PlatformType: z.string().optional(),
    PlatformName: z.string().optional(),
  })).optional(),
});

/** EC2 single instance (from describe-instances query) */
export const EC2SingleInstanceSchema = z.object({
  State: z.object({
    Name: z.string().optional(),
  }).optional(),
  InstanceType: z.string().optional(),
  Placement: z.object({
    AvailabilityZone: z.string().optional(),
  }).optional(),
  PrivateIpAddress: z.string().optional(),
  PublicIpAddress: z.string().optional(),
  LaunchTime: z.string().optional(),
});

// ============================================================
// tf-destroy.ts Resource Cleaner Schemas
// ============================================================

/** ALB from elbv2 describe-load-balancers */
export const ALBSchema = z.object({
  LoadBalancerName: z.string(),
  LoadBalancerArn: z.string(),
  VpcId: z.string().optional(),
});
export const ALBListSchema = z.array(ALBSchema);
export type ALBResponse = z.infer<typeof ALBSchema>;

/** Target Group from elbv2 describe-target-groups */
export const TargetGroupSchema = z.object({
  TargetGroupName: z.string(),
  TargetGroupArn: z.string(),
  VpcId: z.string().optional(),
});
export const TargetGroupListSchema = z.array(TargetGroupSchema);
export type TargetGroupResponse = z.infer<typeof TargetGroupSchema>;

/** VPC Endpoint from ec2 describe-vpc-endpoints */
export const VpcEndpointSchema = z.object({
  VpcEndpointId: z.string(),
  ServiceName: z.string(),
});
export const VpcEndpointListSchema = z.array(VpcEndpointSchema);
export type VpcEndpointResponse = z.infer<typeof VpcEndpointSchema>;

/** NAT Gateway from ec2 describe-nat-gateways */
export const NatGatewaySchema = z.object({
  NatGatewayId: z.string(),
});
export const NatGatewayListSchema = z.array(NatGatewaySchema);
export type NatGatewayResponse = z.infer<typeof NatGatewaySchema>;

/** Elastic IP from ec2 describe-addresses */
export const ElasticIPSchema = z.object({
  AllocationId: z.string(),
  PublicIp: z.string(),
  Tags: z.array(z.object({
    Key: z.string(),
    Value: z.string(),
  })).optional(),
});
export const ElasticIPListSchema = z.array(ElasticIPSchema);
export type ElasticIPResponse = z.infer<typeof ElasticIPSchema>;

/** Network Interface from ec2 describe-network-interfaces */
export const NetworkInterfaceSchema = z.object({
  NetworkInterfaceId: z.string(),
  Description: z.string().optional(),
});
export const NetworkInterfaceListSchema = z.array(NetworkInterfaceSchema);
export type NetworkInterfaceResponse = z.infer<typeof NetworkInterfaceSchema>;

/** Security Group Rule from ec2 describe-security-group-rules */
export const SecurityGroupRuleSchema = z.object({
  SecurityGroupRuleId: z.string(),
  IsEgress: z.boolean(),
});
export const SecurityGroupRuleListSchema = z.array(SecurityGroupRuleSchema);

/** Security Group from ec2 describe-security-groups */
export const SecurityGroupSchema = z.object({
  GroupId: z.string(),
  GroupName: z.string(),
});
export const SecurityGroupListSchema = z.array(SecurityGroupSchema);
export type SecurityGroupResponse = z.infer<typeof SecurityGroupSchema>;

/** S3 Object Version from s3api list-object-versions */
export const S3ObjectVersionSchema = z.object({
  Key: z.string(),
  VersionId: z.string(),
});
export const S3ObjectVersionListSchema = z.array(S3ObjectVersionSchema);

/** EBS Volume from ec2 describe-volumes */
export const EBSVolumeSchema = z.object({
  VolumeId: z.string(),
  Size: z.number(),
  State: z.string(),
  AvailabilityZone: z.string().optional(),
  SnapshotId: z.string().optional(),
  Tags: z.array(z.object({
    Key: z.string(),
    Value: z.string(),
  })).optional(),
});
export const EBSVolumeListSchema = z.array(EBSVolumeSchema);
export type EBSVolumeResponse = z.infer<typeof EBSVolumeSchema>;

/** Karpenter-provisioned EC2 instance from ec2 describe-instances */
export const KarpenterNodeSchema = z.object({
  InstanceId: z.string(),
  InstanceType: z.string().optional(),
  State: z.object({
    Name: z.string(),
  }).optional(),
  Tags: z.array(z.object({
    Key: z.string(),
    Value: z.string(),
  })).optional(),
});
export const KarpenterNodeListSchema = z.array(KarpenterNodeSchema);
export type KarpenterNodeResponse = z.infer<typeof KarpenterNodeSchema>;

/** Generic string array (for nodegroups, log groups, etc.) */
export const StringArraySchema = z.array(z.string());

// ============================================================
// lib.ts AWS Service Schemas
// ============================================================

/** ECR create-repository response */
export const ECRCreateRepositorySchema = z.object({
  repository: z.object({
    repositoryName: z.string(),
    repositoryUri: z.string(),
    repositoryArn: z.string(),
  }).optional(),
});

/** ECR image array (from query 'imageDetails[*]') */
export const ECRImageArraySchema = z.array(z.object({
  imageTags: z.array(z.string()).optional(),
  imageDigest: z.string().optional(),
  imageSizeInBytes: z.number().optional(),
  imagePushedAt: z.string().optional(),
}));

/** S3 list-buckets response */
export const S3BucketsSchema = z.object({
  Buckets: z.array(z.object({
    Name: z.string().optional(),
    CreationDate: z.string().optional(),
  })).optional(),
});

/** S3 get-bucket-encryption response */
export const S3EncryptionSchema = z.object({
  ServerSideEncryptionConfiguration: z.object({
    Rules: z.array(z.object({
      ApplyServerSideEncryptionByDefault: z.object({
        SSEAlgorithm: z.string().optional(),
      }).optional(),
    })).optional(),
  }).optional(),
});

/** Secrets Manager create-secret response */
export const SecretsCreateSchema = z.object({
  ARN: z.string().optional(),
  Name: z.string().optional(),
});

/** Secrets Manager list-secrets query response */
export const SecretsListItemSchema = z.object({
  Name: z.string(),
  Description: z.string().optional(),
  Modified: z.string().optional(),
});
export const SecretsListSchema = z.array(SecretsListItemSchema);
export type SecretsListItemResponse = z.infer<typeof SecretsListItemSchema>;

/** Secrets Manager describe-secret response */
export const SecretsDescribeSchema = z.object({
  Name: z.string().optional(),
  ARN: z.string().optional(),
  Description: z.string().optional(),
  CreatedDate: z.string().optional(),
  LastChangedDate: z.string().optional(),
});

/** EKS describe-cluster response */
export const EKSDescribeClusterSchema = z.object({
  cluster: z.object({
    name: z.string().optional(),
    arn: z.string().optional(),
    status: z.string().optional(),
    endpoint: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
});

// ============================================================
// Utility Functions
// ============================================================

/**
 * Safe JSON parse with Zod validation.
 * Returns null if parsing or validation fails.
 */
export function safeParseJson<T>(
  json: string,
  schema: z.ZodType<T>,
  onError?: (error: z.ZodError) => void
): T | null {
  try {
    const data = JSON.parse(json);
    const result = schema.safeParse(data);
    if (result.success) {
      return result.data;
    }
    onError?.(result.error);
    return null;
  } catch {
    return null;
  }
}
