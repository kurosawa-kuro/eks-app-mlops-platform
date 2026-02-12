/**
 * AWS Adapter Type Definitions
 */

import type { Instance, Volume, SecurityGroup, KeyPairInfo, Vpc, Subnet, InternetGateway, RouteTable, NatGateway, VpcEndpoint } from "@aws-sdk/client-ec2"
import type { Cluster, Nodegroup, Addon } from "@aws-sdk/client-eks"
import type { Bucket } from "@aws-sdk/client-s3"
import type { LoadBalancer, TargetGroup } from "@aws-sdk/client-elastic-load-balancing-v2"
import type { DBInstance, DBCluster } from "@aws-sdk/client-rds"
import type { CacheCluster, ReplicationGroup } from "@aws-sdk/client-elasticache"
import type { FunctionConfiguration } from "@aws-sdk/client-lambda"
import type { Repository } from "@aws-sdk/client-ecr"
import type { LogGroup } from "@aws-sdk/client-cloudwatch-logs"
import type { HostedZone, ResourceRecordSet } from "@aws-sdk/client-route-53"
import type { CertificateSummary, CertificateDetail } from "@aws-sdk/client-acm"
import type { KeyMetadata, AliasListEntry } from "@aws-sdk/client-kms"
import type { Role, Policy } from "@aws-sdk/client-iam"
import type { AutoScalingGroup } from "@aws-sdk/client-auto-scaling"
import type { DeliveryStreamDescription } from "@aws-sdk/client-firehose"

// ============================================================================
// EC2 Adapter
// ============================================================================

export interface IEC2Adapter {
  describeInstances(): Promise<Instance[]>
  describeInstancesByIds(instanceIds: string[]): Promise<Instance[]>
  describeNatGateways(): Promise<NatGateway[]>
  describeElasticIps(): Promise<ElasticIpInfo[]>
  describeVolumes(): Promise<Volume[]>
  describeSecurityGroups(): Promise<SecurityGroup[]>
  describeKeyPairs(): Promise<KeyPairInfo[]>
  getConsoleOutput(instanceId: string): Promise<ConsoleOutputInfo | null>
}

export interface ElasticIpInfo {
  allocationId: string | undefined
  publicIp: string | undefined
  associationId: string | undefined
  instanceId: string | undefined
  domain: string | undefined
  tags: Record<string, string>
}

export interface ConsoleOutputInfo {
  instanceId: string
  output: string | null
  timestamp: Date | null
}

// ============================================================================
// VPC Adapter (Extended EC2)
// ============================================================================

export interface IVPCAdapter {
  describeVpcs(): Promise<Vpc[]>
  describeSubnets(): Promise<Subnet[]>
  describeInternetGateways(): Promise<InternetGateway[]>
  describeRouteTables(): Promise<RouteTable[]>
  describeVpcEndpoints(): Promise<VpcEndpoint[]>
}

// ============================================================================
// EKS Adapter
// ============================================================================

export interface IEKSAdapter {
  listClusters(): Promise<string[]>
  describeCluster(name: string): Promise<Cluster | null>
  listNodegroups(clusterName: string): Promise<string[]>
  describeNodegroup(clusterName: string, nodegroupName: string): Promise<Nodegroup | null>
  listAddons(clusterName: string): Promise<string[]>
  describeAddon(clusterName: string, addonName: string): Promise<Addon | null>
}

// ============================================================================
// S3 Adapter
// ============================================================================

export interface IS3Adapter {
  listBuckets(): Promise<Bucket[]>
  getBucketLocation(bucketName: string): Promise<string | undefined>
  getBucketTagging(bucketName: string): Promise<Record<string, string>>
}

// ============================================================================
// Cost Explorer Adapter
// ============================================================================

export interface ICostAdapter {
  getCostAndUsage(start: string, end: string): Promise<CostResult[]>
}

export interface CostResult {
  periodStart: string
  periodEnd: string
  service: string
  amount: number
  unit: string
}

// ============================================================================
// ELB Adapter
// ============================================================================

export interface IELBAdapter {
  describeLoadBalancers(): Promise<LoadBalancer[]>
  describeTargetGroups(): Promise<TargetGroup[]>
}

// ============================================================================
// RDS Adapter
// ============================================================================

export interface IRDSAdapter {
  describeDBInstances(): Promise<DBInstance[]>
  describeDBClusters(): Promise<DBCluster[]>
}

// ============================================================================
// ElastiCache Adapter
// ============================================================================

export interface IElastiCacheAdapter {
  describeCacheClusters(): Promise<CacheCluster[]>
  describeReplicationGroups(): Promise<ReplicationGroup[]>
}

// ============================================================================
// Lambda Adapter
// ============================================================================

export interface ILambdaAdapter {
  listFunctions(): Promise<FunctionConfiguration[]>
}

// ============================================================================
// ECR Adapter
// ============================================================================

export interface IECRAdapter {
  describeRepositories(): Promise<Repository[]>
  listTagsForResource(resourceArn: string): Promise<Record<string, string>>
}

// ============================================================================
// CloudWatch Logs Adapter
// ============================================================================

export interface ICloudWatchLogsAdapter {
  describeLogGroups(): Promise<LogGroup[]>
  listTagsForResource(resourceArn: string): Promise<Record<string, string>>
}

// ============================================================================
// Route53 Adapter
// ============================================================================

export interface IRoute53Adapter {
  listHostedZones(): Promise<HostedZone[]>
  listResourceRecordSets(hostedZoneId: string): Promise<ResourceRecordSet[]>
}

// ============================================================================
// ACM Adapter
// ============================================================================

export interface IACMAdapter {
  listCertificates(): Promise<CertificateSummary[]>
  describeCertificate(arn: string): Promise<CertificateDetail | null>
}

// ============================================================================
// KMS Adapter
// ============================================================================

export interface IKMSAdapter {
  listKeys(): Promise<KeyMetadata[]>
  listAliases(): Promise<AliasListEntry[]>
}

// ============================================================================
// IAM Adapter
// ============================================================================

export interface IIAMAdapter {
  listRoles(): Promise<Role[]>
  listPolicies(): Promise<Policy[]>
}

// ============================================================================
// Auto Scaling Adapter
// ============================================================================

export interface IAutoScalingAdapter {
  describeAutoScalingGroups(): Promise<AutoScalingGroup[]>
}

// ============================================================================
// SQS Adapter
// ============================================================================

export interface ISQSAdapter {
  listQueues(): Promise<SQSQueueInfo[]>
}

export interface SQSQueueInfo {
  queueUrl: string
  queueName: string
  attributes: Record<string, string>
}

// ============================================================================
// Kinesis Firehose Adapter
// ============================================================================

export interface IFirehoseAdapter {
  listDeliveryStreams(): Promise<string[]>
  describeDeliveryStream(streamName: string): Promise<DeliveryStreamDescription | null>
  listTagsForDeliveryStream(streamName: string): Promise<Record<string, string>>
}

// ============================================================================
// Helper Types
// ============================================================================

export function extractTags(tags?: Array<{ Key?: string; Value?: string }>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const tag of tags ?? []) {
    if (tag.Key) {
      result[tag.Key] = tag.Value ?? ""
    }
  }
  return result
}
