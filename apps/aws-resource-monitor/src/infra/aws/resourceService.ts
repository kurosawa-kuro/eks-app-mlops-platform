/**
 * AWS Resource Service
 * Fetches and caches AWS resources using adapters
 */

import { v4 as uuidv4 } from "uuid"
import type { Resource, ResourceType, ResourceCategory } from "../../domain/entities/resource.js"
import { RESOURCE_CATEGORY_TYPES } from "../../domain/entities/resource.js"
import type { CacheService } from "../cache/memoryCache.js"
import { extractTags } from "./adapters/types.js"
import type {
  IEC2Adapter,
  IVPCAdapter,
  IEKSAdapter,
  IS3Adapter,
  IELBAdapter,
  IRDSAdapter,
  IElastiCacheAdapter,
  ILambdaAdapter,
  IECRAdapter,
  ICloudWatchLogsAdapter,
  IRoute53Adapter,
  IACMAdapter,
  IKMSAdapter,
  IIAMAdapter,
  IAutoScalingAdapter,
  ISQSAdapter,
  IFirehoseAdapter,
} from "./adapters/types.js"

export interface AWSAdapters {
  ec2: IEC2Adapter
  vpc: IVPCAdapter
  eks: IEKSAdapter
  s3: IS3Adapter
  elb: IELBAdapter
  rds: IRDSAdapter
  elasticache: IElastiCacheAdapter
  lambda: ILambdaAdapter
  ecr: IECRAdapter
  cloudwatchlogs: ICloudWatchLogsAdapter
  route53: IRoute53Adapter
  acm: IACMAdapter
  kms: IKMSAdapter
  iam: IIAMAdapter
  autoscaling: IAutoScalingAdapter
  sqs: ISQSAdapter
  firehose: IFirehoseAdapter
}

export interface ResourceService {
  getResources(type: ResourceType, forceRefresh?: boolean): Promise<Resource[]>
  getAllResources(forceRefresh?: boolean): Promise<Resource[]>
  getResourcesByCategory(category: ResourceCategory, forceRefresh?: boolean): Promise<Resource[]>
  getEksRelatedResources(forceRefresh?: boolean): Promise<Resource[]>
  refreshAll(): Promise<void>
  getLastUpdated(): Map<ResourceType, Date | null>
  getStats(): Promise<{ total: number; byType: Record<string, number> }>
}

const CACHE_PREFIX = "resources:"

export function createResourceService(
  adapters: AWSAdapters,
  cache: CacheService,
  cacheTtlMs: number
): ResourceService {
  async function fetchEC2Instances(): Promise<Resource[]> {
    const instances = await adapters.ec2.describeInstances()
    return instances.map((instance) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "ec2" as ResourceType,
      resourceId: instance.InstanceId ?? "",
      name: extractTags(instance.Tags)["Name"] ?? null,
      state: instance.State?.Name ?? "unknown",
      createdAt: instance.LaunchTime ?? null,
      metadata: {
        instanceType: instance.InstanceType,
        privateIp: instance.PrivateIpAddress,
        publicIp: instance.PublicIpAddress,
        launchTime: instance.LaunchTime,
        availabilityZone: instance.Placement?.AvailabilityZone,
        vpcId: instance.VpcId,
        subnetId: instance.SubnetId,
      },
      tags: extractTags(instance.Tags),
    }))
  }

  async function fetchEKSClusters(): Promise<Resource[]> {
    const clusterNames = await adapters.eks.listClusters()
    const resources: Resource[] = []

    for (const name of clusterNames) {
      const cluster = await adapters.eks.describeCluster(name)
      if (cluster) {
        resources.push({
          id: uuidv4(),
          timestamp: new Date(),
          type: "eks" as ResourceType,
          resourceId: cluster.arn ?? "",
          name: cluster.name ?? null,
          state: cluster.status ?? "unknown",
          createdAt: cluster.createdAt ?? null,
          metadata: {
            version: cluster.version,
            endpoint: cluster.endpoint,
            roleArn: cluster.roleArn,
            vpcId: cluster.resourcesVpcConfig?.vpcId,
            platformVersion: cluster.platformVersion,
          },
          tags: cluster.tags ?? {},
        })
      }
    }

    return resources
  }

  async function fetchNodegroups(): Promise<Resource[]> {
    const clusterNames = await adapters.eks.listClusters()
    const resources: Resource[] = []

    for (const clusterName of clusterNames) {
      const nodegroupNames = await adapters.eks.listNodegroups(clusterName)
      for (const nodegroupName of nodegroupNames) {
        const nodegroup = await adapters.eks.describeNodegroup(clusterName, nodegroupName)
        if (nodegroup) {
          resources.push({
            id: uuidv4(),
            timestamp: new Date(),
            type: "nodegroup" as ResourceType,
            resourceId: nodegroup.nodegroupArn ?? "",
            name: nodegroup.nodegroupName ?? null,
            state: nodegroup.status ?? "unknown",
            createdAt: nodegroup.createdAt ?? null,
            metadata: {
              clusterName,
              instanceTypes: nodegroup.instanceTypes,
              scalingConfig: nodegroup.scalingConfig,
              amiType: nodegroup.amiType,
              nodeRole: nodegroup.nodeRole,
              subnets: nodegroup.subnets,
            },
            tags: nodegroup.tags ?? {},
          })
        }
      }
    }

    return resources
  }

  async function fetchEKSAddons(): Promise<Resource[]> {
    const clusterNames = await adapters.eks.listClusters()
    const resources: Resource[] = []

    for (const clusterName of clusterNames) {
      const addonNames = await adapters.eks.listAddons(clusterName)
      for (const addonName of addonNames) {
        const addon = await adapters.eks.describeAddon(clusterName, addonName)
        if (addon) {
          resources.push({
            id: uuidv4(),
            timestamp: new Date(),
            type: "eksaddon" as ResourceType,
            resourceId: addon.addonArn ?? "",
            name: addon.addonName ?? null,
            state: addon.status ?? "unknown",
            createdAt: addon.createdAt ?? null,
            metadata: {
              clusterName,
              addonVersion: addon.addonVersion,
              serviceAccountRoleArn: addon.serviceAccountRoleArn,
            },
            tags: addon.tags ?? {},
          })
        }
      }
    }

    return resources
  }

  async function fetchS3Buckets(): Promise<Resource[]> {
    const buckets = await adapters.s3.listBuckets()
    const resources: Resource[] = []

    for (const bucket of buckets) {
      const [location, tags] = await Promise.all([
        adapters.s3.getBucketLocation(bucket.Name ?? ""),
        adapters.s3.getBucketTagging(bucket.Name ?? "")
      ])
      resources.push({
        id: uuidv4(),
        timestamp: new Date(),
        type: "s3" as ResourceType,
        resourceId: bucket.Name ?? "",
        name: bucket.Name ?? null,
        state: "available",
        createdAt: bucket.CreationDate ?? null,
        metadata: {
          creationDate: bucket.CreationDate,
          region: location,
        },
        tags,
      })
    }

    return resources
  }

  async function fetchVPCs(): Promise<Resource[]> {
    const vpcs = await adapters.vpc.describeVpcs()
    return vpcs.map((vpc) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "vpc" as ResourceType,
      resourceId: vpc.VpcId ?? "",
      name: extractTags(vpc.Tags)["Name"] ?? null,
      state: vpc.State ?? "unknown",
      createdAt: null,
      metadata: {
        cidrBlock: vpc.CidrBlock,
        isDefault: vpc.IsDefault,
        dhcpOptionsId: vpc.DhcpOptionsId,
      },
      tags: extractTags(vpc.Tags),
    }))
  }

  async function fetchSubnets(): Promise<Resource[]> {
    const subnets = await adapters.vpc.describeSubnets()
    return subnets.map((subnet) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "subnet" as ResourceType,
      resourceId: subnet.SubnetId ?? "",
      name: extractTags(subnet.Tags)["Name"] ?? null,
      state: subnet.State ?? "unknown",
      createdAt: null,
      metadata: {
        vpcId: subnet.VpcId,
        cidrBlock: subnet.CidrBlock,
        availabilityZone: subnet.AvailabilityZone,
        availableIpAddressCount: subnet.AvailableIpAddressCount,
        mapPublicIpOnLaunch: subnet.MapPublicIpOnLaunch,
      },
      tags: extractTags(subnet.Tags),
    }))
  }

  async function fetchInternetGateways(): Promise<Resource[]> {
    const igws = await adapters.vpc.describeInternetGateways()
    return igws.map((igw) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "igw" as ResourceType,
      resourceId: igw.InternetGatewayId ?? "",
      name: extractTags(igw.Tags)["Name"] ?? null,
      state: igw.Attachments?.[0]?.State ?? "detached",
      createdAt: null,
      metadata: {
        attachedVpcId: igw.Attachments?.[0]?.VpcId,
      },
      tags: extractTags(igw.Tags),
    }))
  }

  async function fetchRouteTables(): Promise<Resource[]> {
    const routeTables = await adapters.vpc.describeRouteTables()
    return routeTables.map((rt) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "routetable" as ResourceType,
      resourceId: rt.RouteTableId ?? "",
      name: extractTags(rt.Tags)["Name"] ?? null,
      state: "available",
      createdAt: null,
      metadata: {
        vpcId: rt.VpcId,
        routeCount: rt.Routes?.length ?? 0,
        associationCount: rt.Associations?.length ?? 0,
      },
      tags: extractTags(rt.Tags),
    }))
  }

  async function fetchNatGateways(): Promise<Resource[]> {
    const natGateways = await adapters.ec2.describeNatGateways()
    return natGateways.map((nat) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "natgateway" as ResourceType,
      resourceId: nat.NatGatewayId ?? "",
      name: extractTags(nat.Tags)["Name"] ?? null,
      state: nat.State ?? "unknown",
      createdAt: nat.CreateTime ?? null,
      metadata: {
        vpcId: nat.VpcId,
        subnetId: nat.SubnetId,
        connectivityType: nat.ConnectivityType,
      },
      tags: extractTags(nat.Tags),
    }))
  }

  async function fetchVpcEndpoints(): Promise<Resource[]> {
    const endpoints = await adapters.vpc.describeVpcEndpoints()
    return endpoints.map((ep) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "vpcendpoint" as ResourceType,
      resourceId: ep.VpcEndpointId ?? "",
      name: extractTags(ep.Tags)["Name"] ?? null,
      state: ep.State ?? "unknown",
      createdAt: ep.CreationTimestamp ?? null,
      metadata: {
        vpcId: ep.VpcId,
        serviceName: ep.ServiceName,
        vpcEndpointType: ep.VpcEndpointType,
      },
      tags: extractTags(ep.Tags),
    }))
  }

  async function fetchLoadBalancers(): Promise<Resource[]> {
    const lbs = await adapters.elb.describeLoadBalancers()
    return lbs.map((lb) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "elb" as ResourceType,
      resourceId: lb.LoadBalancerArn ?? "",
      name: lb.LoadBalancerName ?? null,
      state: lb.State?.Code ?? "unknown",
      createdAt: lb.CreatedTime ?? null,
      metadata: {
        type: lb.Type,
        scheme: lb.Scheme,
        vpcId: lb.VpcId,
        dnsName: lb.DNSName,
        availabilityZones: lb.AvailabilityZones?.map((az) => az.ZoneName),
      },
      tags: {},
    }))
  }

  async function fetchTargetGroups(): Promise<Resource[]> {
    const tgs = await adapters.elb.describeTargetGroups()
    return tgs.map((tg) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "targetgroup" as ResourceType,
      resourceId: tg.TargetGroupArn ?? "",
      name: tg.TargetGroupName ?? null,
      state: "available",
      createdAt: null,
      metadata: {
        protocol: tg.Protocol,
        port: tg.Port,
        vpcId: tg.VpcId,
        targetType: tg.TargetType,
        healthCheckPath: tg.HealthCheckPath,
      },
      tags: {},
    }))
  }

  async function fetchElasticIPs(): Promise<Resource[]> {
    const eips = await adapters.ec2.describeElasticIps()
    return eips.map((eip) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "eip" as ResourceType,
      resourceId: eip.allocationId ?? "",
      name: eip.tags["Name"] ?? null,
      state: eip.associationId ? "associated" : "available",
      createdAt: null,
      metadata: {
        publicIp: eip.publicIp,
        instanceId: eip.instanceId,
        domain: eip.domain,
      },
      tags: eip.tags,
    }))
  }

  async function fetchSecurityGroups(): Promise<Resource[]> {
    const sgs = await adapters.ec2.describeSecurityGroups()
    return sgs.map((sg) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "securitygroup" as ResourceType,
      resourceId: sg.GroupId ?? "",
      name: sg.GroupName ?? null,
      state: "available",
      createdAt: null,
      metadata: {
        description: sg.Description,
        vpcId: sg.VpcId,
        inboundRuleCount: sg.IpPermissions?.length ?? 0,
        outboundRuleCount: sg.IpPermissionsEgress?.length ?? 0,
      },
      tags: extractTags(sg.Tags),
    }))
  }

  async function fetchKeyPairs(): Promise<Resource[]> {
    const keyPairs = await adapters.ec2.describeKeyPairs()
    return keyPairs.map((kp) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "keypair" as ResourceType,
      resourceId: kp.KeyPairId ?? "",
      name: kp.KeyName ?? null,
      state: "available",
      createdAt: kp.CreateTime ?? null,
      metadata: {
        keyFingerprint: kp.KeyFingerprint,
        keyType: kp.KeyType,
        createTime: kp.CreateTime,
      },
      tags: extractTags(kp.Tags),
    }))
  }

  async function fetchEBSVolumes(): Promise<Resource[]> {
    const volumes = await adapters.ec2.describeVolumes()
    return volumes.map((vol) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "ebs" as ResourceType,
      resourceId: vol.VolumeId ?? "",
      name: extractTags(vol.Tags)["Name"] ?? null,
      state: vol.State ?? "unknown",
      createdAt: vol.CreateTime ?? null,
      metadata: {
        size: vol.Size,
        volumeType: vol.VolumeType,
        iops: vol.Iops,
        encrypted: vol.Encrypted,
        availabilityZone: vol.AvailabilityZone,
        attachedInstanceId: vol.Attachments?.[0]?.InstanceId,
      },
      tags: extractTags(vol.Tags),
    }))
  }

  async function fetchRDSInstances(): Promise<Resource[]> {
    const instances = await adapters.rds.describeDBInstances()
    return instances.map((db) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "rds" as ResourceType,
      resourceId: db.DBInstanceArn ?? "",
      name: db.DBInstanceIdentifier ?? null,
      state: db.DBInstanceStatus ?? "unknown",
      createdAt: db.InstanceCreateTime ?? null,
      metadata: {
        engine: db.Engine,
        engineVersion: db.EngineVersion,
        instanceClass: db.DBInstanceClass,
        multiAZ: db.MultiAZ,
        storageType: db.StorageType,
        allocatedStorage: db.AllocatedStorage,
        endpoint: db.Endpoint?.Address,
      },
      tags: {},
    }))
  }

  async function fetchElastiCacheClusters(): Promise<Resource[]> {
    const clusters = await adapters.elasticache.describeCacheClusters()
    return clusters.map((cluster) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "elasticache" as ResourceType,
      resourceId: cluster.ARN ?? "",
      name: cluster.CacheClusterId ?? null,
      state: cluster.CacheClusterStatus ?? "unknown",
      createdAt: cluster.CacheClusterCreateTime ?? null,
      metadata: {
        engine: cluster.Engine,
        engineVersion: cluster.EngineVersion,
        cacheNodeType: cluster.CacheNodeType,
        numCacheNodes: cluster.NumCacheNodes,
      },
      tags: {},
    }))
  }

  async function fetchLambdaFunctions(): Promise<Resource[]> {
    const functions = await adapters.lambda.listFunctions()
    return functions.map((fn) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "lambda" as ResourceType,
      resourceId: fn.FunctionArn ?? "",
      name: fn.FunctionName ?? null,
      state: fn.State ?? "Active",
      createdAt: fn.LastModified ? new Date(fn.LastModified) : null,
      metadata: {
        runtime: fn.Runtime,
        memorySize: fn.MemorySize,
        timeout: fn.Timeout,
        handler: fn.Handler,
        codeSize: fn.CodeSize,
        lastModified: fn.LastModified,
      },
      tags: {},
    }))
  }

  async function fetchECRRepositories(): Promise<Resource[]> {
    const repos = await adapters.ecr.describeRepositories()
    const resources: Resource[] = []

    for (const repo of repos) {
      const tags = await adapters.ecr.listTagsForResource(repo.repositoryArn ?? "")
      resources.push({
        id: uuidv4(),
        timestamp: new Date(),
        type: "ecr" as ResourceType,
        resourceId: repo.repositoryArn ?? "",
        name: repo.repositoryName ?? null,
        state: "available",
        createdAt: repo.createdAt ?? null,
        metadata: {
          registryId: repo.registryId,
          repositoryUri: repo.repositoryUri,
          createdAt: repo.createdAt,
          imageScanningConfiguration: repo.imageScanningConfiguration,
        },
        tags,
      })
    }

    return resources
  }

  async function fetchCloudWatchLogGroups(): Promise<Resource[]> {
    const logGroups = await adapters.cloudwatchlogs.describeLogGroups()
    const resources: Resource[] = []

    for (const lg of logGroups) {
      const tags = await adapters.cloudwatchlogs.listTagsForResource(lg.arn ?? "")
      resources.push({
        id: uuidv4(),
        timestamp: new Date(),
        type: "cloudwatchlogs" as ResourceType,
        resourceId: lg.arn ?? "",
        name: lg.logGroupName ?? null,
        state: "available",
        createdAt: lg.creationTime ? new Date(lg.creationTime) : null,
        metadata: {
          retentionInDays: lg.retentionInDays,
          storedBytes: lg.storedBytes,
          creationTime: lg.creationTime,
          kmsKeyId: lg.kmsKeyId,
        },
        tags,
      })
    }

    return resources
  }

  async function fetchRoute53Zones(): Promise<Resource[]> {
    const zones = await adapters.route53.listHostedZones()
    return zones.map((zone) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "route53zone" as ResourceType,
      resourceId: zone.Id ?? "",
      name: zone.Name ?? null,
      state: "available",
      createdAt: null,
      metadata: {
        recordCount: zone.ResourceRecordSetCount,
        comment: zone.Config?.Comment,
        privateZone: zone.Config?.PrivateZone,
      },
      tags: {},
    }))
  }

  async function fetchACMCertificates(): Promise<Resource[]> {
    const certs = await adapters.acm.listCertificates()
    const resources: Resource[] = []

    for (const cert of certs) {
      const detail = await adapters.acm.describeCertificate(cert.CertificateArn ?? "")
      resources.push({
        id: uuidv4(),
        timestamp: new Date(),
        type: "acmcertificate" as ResourceType,
        resourceId: cert.CertificateArn ?? "",
        name: cert.DomainName ?? null,
        state: detail?.Status ?? cert.Status ?? "unknown",
        createdAt: detail?.CreatedAt ?? null,
        metadata: {
          type: detail?.Type,
          keyAlgorithm: detail?.KeyAlgorithm,
          issuer: detail?.Issuer,
          notBefore: detail?.NotBefore,
          notAfter: detail?.NotAfter,
          subjectAlternativeNames: detail?.SubjectAlternativeNames,
        },
        tags: {},
      })
    }

    return resources
  }

  async function fetchKMSKeys(): Promise<Resource[]> {
    const keys = await adapters.kms.listKeys()
    return keys.map((key) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "kmskey" as ResourceType,
      resourceId: key.Arn ?? "",
      name: key.Description ?? key.KeyId ?? null,
      state: key.KeyState ?? "unknown",
      createdAt: key.CreationDate ?? null,
      metadata: {
        keyId: key.KeyId,
        keyUsage: key.KeyUsage,
        keySpec: key.KeySpec,
        keyManager: key.KeyManager,
        creationDate: key.CreationDate,
      },
      tags: {},
    }))
  }

  async function fetchIAMRoles(): Promise<Resource[]> {
    const roles = await adapters.iam.listRoles()
    return roles.map((role) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "iamrole" as ResourceType,
      resourceId: role.Arn ?? "",
      name: role.RoleName ?? null,
      state: "available",
      createdAt: role.CreateDate ?? null,
      metadata: {
        path: role.Path,
        createDate: role.CreateDate,
        maxSessionDuration: role.MaxSessionDuration,
        description: role.Description,
      },
      tags: {},
    }))
  }

  async function fetchIAMPolicies(): Promise<Resource[]> {
    const policies = await adapters.iam.listPolicies()
    return policies.map((policy) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "iampolicy" as ResourceType,
      resourceId: policy.Arn ?? "",
      name: policy.PolicyName ?? null,
      state: "available",
      createdAt: policy.CreateDate ?? null,
      metadata: {
        path: policy.Path,
        createDate: policy.CreateDate,
        updateDate: policy.UpdateDate,
        attachmentCount: policy.AttachmentCount,
        defaultVersionId: policy.DefaultVersionId,
      },
      tags: {},
    }))
  }

  async function fetchAutoScalingGroups(): Promise<Resource[]> {
    const groups = await adapters.autoscaling.describeAutoScalingGroups()
    return groups.map((asg) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "autoscalinggroup" as ResourceType,
      resourceId: asg.AutoScalingGroupARN ?? "",
      name: asg.AutoScalingGroupName ?? null,
      state: asg.Status ?? "available",
      createdAt: asg.CreatedTime ?? null,
      metadata: {
        minSize: asg.MinSize,
        maxSize: asg.MaxSize,
        desiredCapacity: asg.DesiredCapacity,
        healthCheckType: asg.HealthCheckType,
        launchConfigurationName: asg.LaunchConfigurationName,
        launchTemplateId: asg.LaunchTemplate?.LaunchTemplateId,
        availabilityZones: asg.AvailabilityZones,
      },
      tags: asg.Tags?.reduce((acc, tag) => {
        if (tag.Key) acc[tag.Key] = tag.Value ?? ""
        return acc
      }, {} as Record<string, string>) ?? {},
    }))
  }

  async function fetchSQSQueues(): Promise<Resource[]> {
    const queues = await adapters.sqs.listQueues()
    return queues.map((queue) => ({
      id: uuidv4(),
      timestamp: new Date(),
      type: "sqsqueue" as ResourceType,
      resourceId: queue.queueUrl,
      name: queue.queueName,
      state: "available",
      createdAt: queue.attributes["CreatedTimestamp"] ? new Date(parseInt(queue.attributes["CreatedTimestamp"]) * 1000) : null,
      metadata: {
        approximateNumberOfMessages: queue.attributes["ApproximateNumberOfMessages"],
        approximateNumberOfMessagesNotVisible: queue.attributes["ApproximateNumberOfMessagesNotVisible"],
        visibilityTimeout: queue.attributes["VisibilityTimeout"],
        createdTimestamp: queue.attributes["CreatedTimestamp"],
      },
      tags: {},
    }))
  }

  async function fetchFirehoseStreams(): Promise<Resource[]> {
    const streamNames = await adapters.firehose.listDeliveryStreams()
    const resources: Resource[] = []

    for (const streamName of streamNames) {
      const [stream, tags] = await Promise.all([
        adapters.firehose.describeDeliveryStream(streamName),
        adapters.firehose.listTagsForDeliveryStream(streamName)
      ])
      if (stream) {
        resources.push({
          id: uuidv4(),
          timestamp: new Date(),
          type: "kinesisfirehose" as ResourceType,
          resourceId: stream.DeliveryStreamARN ?? "",
          name: stream.DeliveryStreamName ?? null,
          state: stream.DeliveryStreamStatus ?? "unknown",
          createdAt: stream.CreateTimestamp ?? null,
          metadata: {
            deliveryStreamType: stream.DeliveryStreamType,
            versionId: stream.VersionId,
            createTimestamp: stream.CreateTimestamp,
          },
          tags,
        })
      }
    }

    return resources
  }

  const fetcherMap: Record<ResourceType, () => Promise<Resource[]>> = {
    ec2: fetchEC2Instances,
    eks: fetchEKSClusters,
    nodegroup: fetchNodegroups,
    eksaddon: fetchEKSAddons,
    s3: fetchS3Buckets,
    vpc: fetchVPCs,
    subnet: fetchSubnets,
    igw: fetchInternetGateways,
    routetable: fetchRouteTables,
    natgateway: fetchNatGateways,
    vpcendpoint: fetchVpcEndpoints,
    elb: fetchLoadBalancers,
    targetgroup: fetchTargetGroups,
    eip: fetchElasticIPs,
    securitygroup: fetchSecurityGroups,
    keypair: fetchKeyPairs,
    ebs: fetchEBSVolumes,
    rds: fetchRDSInstances,
    elasticache: fetchElastiCacheClusters,
    lambda: fetchLambdaFunctions,
    ecr: fetchECRRepositories,
    cloudwatchlogs: fetchCloudWatchLogGroups,
    route53zone: fetchRoute53Zones,
    acmcertificate: fetchACMCertificates,
    kmskey: fetchKMSKeys,
    iamrole: fetchIAMRoles,
    iampolicy: fetchIAMPolicies,
    autoscalinggroup: fetchAutoScalingGroups,
    sqsqueue: fetchSQSQueues,
    kinesisfirehose: fetchFirehoseStreams,
  }

  return {
    async getResources(type: ResourceType, forceRefresh = false): Promise<Resource[]> {
      const cacheKey = `${CACHE_PREFIX}${type}`

      if (!forceRefresh) {
        const cached = cache.get<Resource[]>(cacheKey)
        if (cached) return cached
      }

      const fetcher = fetcherMap[type]
      if (!fetcher) return []

      const resources = await fetcher()
      cache.set(cacheKey, resources, cacheTtlMs)
      return resources
    },

    async getAllResources(forceRefresh = false): Promise<Resource[]> {
      const allResources: Resource[] = []
      const types = Object.keys(fetcherMap) as ResourceType[]

      for (const type of types) {
        const resources = await this.getResources(type, forceRefresh)
        allResources.push(...resources)
      }

      return allResources
    },

    async getResourcesByCategory(category: ResourceCategory, forceRefresh = false): Promise<Resource[]> {
      const types = RESOURCE_CATEGORY_TYPES[category] ?? []
      const allResources: Resource[] = []

      for (const type of types) {
        const resources = await this.getResources(type, forceRefresh)
        allResources.push(...resources)
      }

      return allResources
    },

    async getEksRelatedResources(forceRefresh = false): Promise<Resource[]> {
      return this.getResourcesByCategory("eks-related", forceRefresh)
    },

    async refreshAll(): Promise<void> {
      cache.invalidateByPrefix(CACHE_PREFIX)
    },

    getLastUpdated(): Map<ResourceType, Date | null> {
      const result = new Map<ResourceType, Date | null>()
      const types = Object.keys(fetcherMap) as ResourceType[]

      for (const type of types) {
        const cacheKey = `${CACHE_PREFIX}${type}`
        result.set(type, cache.getLastUpdated(cacheKey))
      }

      return result
    },

    async getStats(): Promise<{ total: number; byType: Record<string, number> }> {
      const types = Object.keys(fetcherMap) as ResourceType[]
      const byType: Record<string, number> = {}
      let total = 0

      for (const type of types) {
        const resources = await this.getResources(type)
        byType[type] = resources.length
        total += resources.length
      }

      return { total, byType }
    },
  }
}
