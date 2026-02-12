/**
 * DI Container - AWS Resource Monitor
 * --------------------------------
 * AWS + K8s サービスの依存登録・解決を一元管理
 */
import { createContainer, asValue, InjectionMode } from 'awilix'
import type { AwilixContainer } from 'awilix'

// AWS types
import type { CacheService } from '../infra/cache/memoryCache.js'
import type { ResourceService } from '../infra/aws/resourceService.js'
import type { CostService } from '../infra/aws/costService.js'
import type { EKSSystemlogService } from '../infra/aws/eksSystemlogService.js'

// K8s types - Minimal Mode
import type { K8sMinimalService } from '../infra/k8s/k8sService.js'

// AWS factories
import { createMemoryCacheService } from '../infra/cache/memoryCache.js'
import {
  EC2Adapter,
  VPCAdapter,
  EKSAdapter,
  S3Adapter,
  ELBAdapter,
  RDSAdapter,
  ElastiCacheAdapter,
  LambdaAdapter,
  ECRAdapter,
  CloudWatchLogsAdapter,
  CostAdapter,
  Route53Adapter,
  ACMAdapter,
  KMSAdapter,
  IAMAdapter,
  AutoScalingAdapter,
  SQSAdapter,
  FirehoseAdapter,
} from '../infra/aws/adapters/index.js'
import { createResourceService } from '../infra/aws/resourceService.js'
import { createCostService } from '../infra/aws/costService.js'
import { createEKSSystemlogService } from '../infra/aws/eksSystemlogService.js'

// K8s factories - Minimal Mode
import { K8sAdapter, K8sSsmAdapter } from '../infra/k8s/adapters/index.js'
import type { IK8sAdapter } from '../infra/k8s/adapters/index.js'
import { createK8sMinimalService } from '../infra/k8s/k8sService.js'
import { SSMAdapter } from '../infra/aws/adapters/index.js'

import { appConfig } from '../env/index.js'

/**
 * DI Container の型定義
 */
export interface Cradle {
  // AWS Services
  cacheService: CacheService
  resourceService: ResourceService
  costService: CostService
  eksSystemlogService: EKSSystemlogService

  // K8s Services - Minimal Mode (optional - enabled by K8S_ENABLED)
  k8sService: K8sMinimalService | null
}

/**
 * 本番用コンテナの作成
 */
export async function createAppContainer(): Promise<AwilixContainer<Cradle>> {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.CLASSIC
  })

  const {
    awsRegion,
    cacheTtlResources,
    cacheTtlCosts,
    cacheTtlK8s,
    k8sMonitoredNamespaces,
  } = appConfig

  // Create AWS adapters
  const ec2Adapter = new EC2Adapter(awsRegion)
  const vpcAdapter = new VPCAdapter(awsRegion)
  const eksAdapter = new EKSAdapter(awsRegion)
  const s3Adapter = new S3Adapter(awsRegion)
  const elbAdapter = new ELBAdapter(awsRegion)
  const rdsAdapter = new RDSAdapter(awsRegion)
  const elastiCacheAdapter = new ElastiCacheAdapter(awsRegion)
  const lambdaAdapter = new LambdaAdapter(awsRegion)
  const ecrAdapter = new ECRAdapter(awsRegion)
  const cloudWatchLogsAdapter = new CloudWatchLogsAdapter(awsRegion)
  const costAdapter = new CostAdapter(awsRegion)
  const route53Adapter = new Route53Adapter(awsRegion)
  const acmAdapter = new ACMAdapter(awsRegion)
  const kmsAdapter = new KMSAdapter(awsRegion)
  const iamAdapter = new IAMAdapter(awsRegion)
  const autoScalingAdapter = new AutoScalingAdapter(awsRegion)
  const sqsAdapter = new SQSAdapter(awsRegion)
  const firehoseAdapter = new FirehoseAdapter(awsRegion)

  // Create AWS services
  const cacheService = createMemoryCacheService()
  const resourceService = createResourceService(
    {
      ec2: ec2Adapter,
      vpc: vpcAdapter,
      eks: eksAdapter,
      s3: s3Adapter,
      elb: elbAdapter,
      rds: rdsAdapter,
      elasticache: elastiCacheAdapter,
      lambda: lambdaAdapter,
      ecr: ecrAdapter,
      cloudwatchlogs: cloudWatchLogsAdapter,
      route53: route53Adapter,
      acm: acmAdapter,
      kms: kmsAdapter,
      iam: iamAdapter,
      autoscaling: autoScalingAdapter,
      sqs: sqsAdapter,
      firehose: firehoseAdapter,
    },
    cacheService,
    cacheTtlResources
  )
  const costService = createCostService(costAdapter, cacheService, cacheTtlCosts)
  const eksSystemlogService = createEKSSystemlogService(eksAdapter, ec2Adapter)

  // Create K8s service - Minimal Mode
  let k8sService: K8sMinimalService | null = null
  const { k8sBastionInstanceId, k8sEksClusterName } = appConfig

  try {
    let k8sAdapter: IK8sAdapter

    if (k8sBastionInstanceId && k8sEksClusterName) {
      // SSM経由でプライベートEKSクラスターにアクセス
      const ssmAdapter = new SSMAdapter({
        region: awsRegion,
        bastionInstanceId: k8sBastionInstanceId,
      })
      k8sAdapter = new K8sSsmAdapter(ssmAdapter, {
        clusterName: k8sEksClusterName,
        region: awsRegion,
      })
    } else {
      // 直接K8s APIにアクセス（クラスター内またはkubeconfig経由）
      k8sAdapter = new K8sAdapter()
    }

    const namespaces = k8sMonitoredNamespaces?.split(',').map(s => s.trim()) || undefined
    k8sService = createK8sMinimalService(k8sAdapter, cacheService, cacheTtlK8s, namespaces)
  } catch {
    // K8s not available - service remains null
  }

  // Register all dependencies
  container.register({
    // AWS Services
    cacheService: asValue(cacheService),
    resourceService: asValue(resourceService),
    costService: asValue(costService),
    eksSystemlogService: asValue(eksSystemlogService),

    // K8s Service - Minimal Mode
    k8sService: asValue(k8sService),
  })

  return container
}
