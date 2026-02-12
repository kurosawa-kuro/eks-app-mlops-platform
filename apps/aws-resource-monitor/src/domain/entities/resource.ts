/**
 * Resource Entity Definitions
 * AWSリソースの型定義とカテゴリ分類
 */

// ============================================================================
// Resource Types (30 types)
// ============================================================================

export type ResourceType =
  // Compute (4)
  | 'ec2'
  | 'eks'
  | 'lambda'
  | 'autoscalinggroup'
  // EKS Related (2)
  | 'eksaddon'
  | 'nodegroup'
  // Storage (3)
  | 's3'
  | 'ebs'
  | 'ecr'
  // Database (2)
  | 'rds'
  | 'elasticache'
  // Networking - Core (6)
  | 'vpc'
  | 'subnet'
  | 'igw'
  | 'routetable'
  | 'natgateway'
  | 'vpcendpoint'
  // Networking - Load Balancing (3)
  | 'elb'
  | 'targetgroup'
  | 'eip'
  // Security (5)
  | 'securitygroup'
  | 'keypair'
  | 'iamrole'
  | 'iampolicy'
  | 'kmskey'
  // DNS & Certificates (2)
  | 'route53zone'
  | 'acmcertificate'
  // Logging & Messaging (3)
  | 'cloudwatchlogs'
  | 'sqsqueue'
  | 'kinesisfirehose'

// ============================================================================
// Resource Categories
// ============================================================================

export type ResourceCategory =
  | 'eks-related'
  | 'compute'
  | 'storage'
  | 'database'
  | 'networking'
  | 'security'
  | 'dns-certificates'
  | 'logging-messaging'

export const RESOURCE_CATEGORY_TYPES: Record<ResourceCategory, ResourceType[]> = {
  'eks-related': ['eks', 'eksaddon', 'nodegroup', 'ec2', 'autoscalinggroup', 'elb', 'targetgroup', 'securitygroup', 'ebs', 'iamrole'],
  'compute': ['ec2', 'eks', 'lambda', 'autoscalinggroup', 'eksaddon', 'nodegroup'],
  'storage': ['s3', 'ebs', 'ecr'],
  'database': ['rds', 'elasticache'],
  'networking': ['vpc', 'subnet', 'igw', 'routetable', 'natgateway', 'vpcendpoint', 'elb', 'targetgroup', 'eip'],
  'security': ['securitygroup', 'keypair', 'iamrole', 'iampolicy', 'kmskey'],
  'dns-certificates': ['route53zone', 'acmcertificate'],
  'logging-messaging': ['cloudwatchlogs', 'sqsqueue', 'kinesisfirehose']
}

// ============================================================================
// Resource Type Labels (for UI display)
// ============================================================================

export const RESOURCE_TYPES: ResourceType[] = [
  // Compute
  'ec2', 'eks', 'lambda', 'autoscalinggroup',
  // EKS Related
  'eksaddon', 'nodegroup',
  // Storage
  's3', 'ebs', 'ecr',
  // Database
  'rds', 'elasticache',
  // Networking - Core
  'vpc', 'subnet', 'igw', 'routetable', 'natgateway', 'vpcendpoint',
  // Networking - Load Balancing
  'elb', 'targetgroup', 'eip',
  // Security
  'securitygroup', 'keypair', 'iamrole', 'iampolicy', 'kmskey',
  // DNS & Certificates
  'route53zone', 'acmcertificate',
  // Logging & Messaging
  'cloudwatchlogs', 'sqsqueue', 'kinesisfirehose'
]

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  // Compute
  ec2: 'EC2 Instances',
  eks: 'EKS Clusters',
  lambda: 'Lambda Functions',
  autoscalinggroup: 'Auto Scaling Groups',
  // EKS Related
  eksaddon: 'EKS Add-ons',
  nodegroup: 'EKS Node Groups',
  // Storage
  s3: 'S3 Buckets',
  ebs: 'EBS Volumes',
  ecr: 'ECR Repositories',
  // Database
  rds: 'RDS Databases',
  elasticache: 'ElastiCache',
  // Networking - Core
  vpc: 'VPCs',
  subnet: 'Subnets',
  igw: 'Internet Gateways',
  routetable: 'Route Tables',
  natgateway: 'NAT Gateways',
  vpcendpoint: 'VPC Endpoints',
  // Networking - Load Balancing
  elb: 'Load Balancers',
  targetgroup: 'Target Groups',
  eip: 'Elastic IPs',
  // Security
  securitygroup: 'Security Groups',
  keypair: 'Key Pairs',
  iamrole: 'IAM Roles',
  iampolicy: 'IAM Policies',
  kmskey: 'KMS Keys',
  // DNS & Certificates
  route53zone: 'Route53 Zones',
  acmcertificate: 'ACM Certificates',
  // Logging & Messaging
  cloudwatchlogs: 'CloudWatch Logs',
  sqsqueue: 'SQS Queues',
  kinesisfirehose: 'Kinesis Firehose'
}

export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  'eks-related': 'EKS Related',
  'compute': 'Compute',
  'storage': 'Storage',
  'database': 'Database',
  'networking': 'Networking',
  'security': 'Security',
  'dns-certificates': 'DNS & Certificates',
  'logging-messaging': 'Logging & Messaging'
}

// ============================================================================
// Resource Entity
// ============================================================================

export interface Resource {
  id: string
  timestamp: Date
  type: ResourceType
  resourceId: string
  name: string | null
  state: string
  createdAt: Date | null
  metadata: Record<string, unknown>
  tags: Record<string, string>
}

// ============================================================================
// Resource Statistics
// ============================================================================

export interface ResourceStats {
  total: number
  byType: Record<ResourceType, number>
  byCategory: Record<ResourceCategory, number>
  lastUpdated: Date | null
}

// ============================================================================
// Helper Functions
// ============================================================================

export function isEksRelatedType(type: ResourceType): boolean {
  return RESOURCE_CATEGORY_TYPES['eks-related'].includes(type)
}

export function getResourceCategory(type: ResourceType): ResourceCategory | null {
  for (const [category, types] of Object.entries(RESOURCE_CATEGORY_TYPES)) {
    if (types.includes(type)) {
      return category as ResourceCategory
    }
  }
  return null
}

// ============================================================================
// High Cost Resource Definitions
// ============================================================================

/**
 * S級（即課金）: 時間単位で課金が発生するリソース
 */
export const HIGH_COST_CRITICAL_TYPES: ResourceType[] = [
  'eks',           // $0.10/hour per cluster
  'nodegroup',     // EC2料金
  'ec2',           // インスタンス料金
  'ebs',           // ボリューム料金
  'elb',           // ロードバランサー料金
  'natgateway',    // $0.045/hour + データ転送
  'rds',           // インスタンス料金
  'elasticache',   // ノード料金
]

/**
 * A級（注意）: 条件により課金が発生するリソース
 */
export const HIGH_COST_WARNING_TYPES: ResourceType[] = [
  'targetgroup',   // ELBに関連
  'eip',           // 未関連付け時$0.005/hour
]

/**
 * 全ての高コストリソースタイプ
 */
export const ALL_HIGH_COST_TYPES: ResourceType[] = [
  ...HIGH_COST_CRITICAL_TYPES,
  ...HIGH_COST_WARNING_TYPES,
]

/**
 * リソースが高コストアラート対象かどうかを判定
 */
export function isHighCostAlertTarget(type: ResourceType, state: string): boolean {
  if (HIGH_COST_CRITICAL_TYPES.includes(type)) {
    // EBS: available（未使用）と in-use（使用中）両方を対象
    if (type === 'ebs' && state !== 'available' && state !== 'in-use') return false
    return true
  }
  if (HIGH_COST_WARNING_TYPES.includes(type)) {
    // EIP: 未関連付けのみ
    if (type === 'eip' && state === 'associated') return false
    return true
  }
  return false
}

/**
 * 高コストリソースの危険度を取得
 */
export function getHighCostLevel(type: ResourceType): 'critical' | 'warning' | null {
  if (HIGH_COST_CRITICAL_TYPES.includes(type)) return 'critical'
  if (HIGH_COST_WARNING_TYPES.includes(type)) return 'warning'
  return null
}
