/**
 * EKS Systemlog Service
 * Provides EKS Nodegroup instance information and EC2 system log access
 */

import type { IEKSAdapter, IEC2Adapter, ConsoleOutputInfo } from "./adapters/types.js"
import { extractTags } from "./adapters/types.js"

export type KubeletJoinStatus = 'joined' | 'joining' | 'failed' | 'unknown'

export interface NodegroupInstanceInfo {
  instanceId: string
  state: string
  availabilityZone: string | null
  launchTime: Date | null
  privateIpAddress: string | null
  instanceType: string | null
  kubeletStatus?: KubeletJoinStatus
}

export interface NodegroupSystemlogInfo {
  clusterName: string
  nodegroupName: string
  nodegroup: {
    status: string
    instanceTypes: string[]
    desiredSize: number
    minSize: number
    maxSize: number
    capacityType: string | null
    amiType: string | null
  }
  instances: NodegroupInstanceInfo[]
}

export interface NodegroupInstanceWithKubeletInfo {
  clusterName: string
  nodegroupName: string
  instances: NodegroupInstanceInfo[]
}

export interface EKSSystemlogService {
  getNodegroupInstances(clusterName: string, nodegroupName: string): Promise<NodegroupSystemlogInfo | null>
  getInstanceSystemlog(instanceId: string): Promise<ConsoleOutputInfo | null>
  getNodegroupInstancesWithKubeletStatus(clusterName: string, nodegroupName: string): Promise<NodegroupInstanceWithKubeletInfo | null>
  parseKubeletStatus(consoleOutput: string | null): KubeletJoinStatus
}

export function createEKSSystemlogService(
  eksAdapter: IEKSAdapter,
  ec2Adapter: IEC2Adapter
): EKSSystemlogService {
  async function getNodegroupInstances(
    clusterName: string,
    nodegroupName: string
  ): Promise<NodegroupSystemlogInfo | null> {
    const nodegroup = await eksAdapter.describeNodegroup(clusterName, nodegroupName)
    if (!nodegroup) {
      return null
    }

    const scalingConfig = nodegroup.scalingConfig ?? {}
    const desiredSize = scalingConfig.desiredSize ?? 0
    const minSize = scalingConfig.minSize ?? 0
    const maxSize = scalingConfig.maxSize ?? 0

    const allInstances = await ec2Adapter.describeInstances()
    const nodegroupInstances = allInstances.filter((instance) => {
      const tags = extractTags(instance.Tags)
      return (
        tags["eks:nodegroup-name"] === nodegroupName &&
        tags["eks:cluster-name"] === clusterName
      )
    })

    const instances: NodegroupInstanceInfo[] = nodegroupInstances.map((instance) => ({
      instanceId: instance.InstanceId ?? "",
      state: instance.State?.Name ?? "unknown",
      availabilityZone: instance.Placement?.AvailabilityZone ?? null,
      launchTime: instance.LaunchTime ?? null,
      privateIpAddress: instance.PrivateIpAddress ?? null,
      instanceType: instance.InstanceType ?? null,
    }))

    return {
      clusterName,
      nodegroupName,
      nodegroup: {
        status: nodegroup.status ?? "unknown",
        instanceTypes: nodegroup.instanceTypes ?? [],
        desiredSize,
        minSize,
        maxSize,
        capacityType: nodegroup.capacityType ?? null,
        amiType: nodegroup.amiType ?? null,
      },
      instances,
    }
  }

  async function getInstanceSystemlog(instanceId: string): Promise<ConsoleOutputInfo | null> {
    return ec2Adapter.getConsoleOutput(instanceId)
  }

  function parseKubeletStatus(consoleOutput: string | null): KubeletJoinStatus {
    if (!consoleOutput) {
      return 'unknown'
    }

    const joinedPatterns = [
      /Successfully registered node/i,
      /kubelet.*started/i,
      /Node.*Ready/i,
      /Successfully joined cluster/i,
      /kubernetes.*node.*registered/i,
      /cloud-init.*finished.*at/i,
      /Startup finished in/i,
      /Started containerd/i,
      /eks-bootstrap.*complete/i,
    ]

    const failedPatterns = [
      /kubelet.*failed/i,
      /failed to register node/i,
      /error.*kubelet/i,
      /cannot join cluster/i,
      /authentication.*failed/i,
      /bootstrap.*failed/i,
    ]

    const joiningPatterns = [
      /starting kubelet/i,
      /kubelet.*starting/i,
      /joining cluster/i,
      /bootstrap.*in progress/i,
      /waiting.*api.*server/i,
    ]

    for (const pattern of failedPatterns) {
      if (pattern.test(consoleOutput)) {
        return 'failed'
      }
    }

    for (const pattern of joinedPatterns) {
      if (pattern.test(consoleOutput)) {
        return 'joined'
      }
    }

    for (const pattern of joiningPatterns) {
      if (pattern.test(consoleOutput)) {
        return 'joining'
      }
    }

    return 'unknown'
  }

  async function getNodegroupInstancesWithKubeletStatus(
    clusterName: string,
    nodegroupName: string
  ): Promise<NodegroupInstanceWithKubeletInfo | null> {
    const allInstances = await ec2Adapter.describeInstances()
    const nodegroupInstances = allInstances.filter((instance) => {
      const tags = extractTags(instance.Tags)
      return (
        tags["eks:nodegroup-name"] === nodegroupName &&
        tags["eks:cluster-name"] === clusterName
      )
    })

    const instances: NodegroupInstanceInfo[] = await Promise.all(
      nodegroupInstances.map(async (instance) => {
        const instanceId = instance.InstanceId ?? ""
        const state = instance.State?.Name ?? "unknown"

        let kubeletStatus: KubeletJoinStatus = 'unknown'

        if (state === 'running' && instanceId) {
          const consoleOutput = await ec2Adapter.getConsoleOutput(instanceId)
          kubeletStatus = parseKubeletStatus(consoleOutput?.output ?? null)
        } else if (state === 'pending') {
          kubeletStatus = 'joining'
        } else if (state === 'terminated' || state === 'stopped') {
          kubeletStatus = 'unknown'
        }

        return {
          instanceId,
          state,
          availabilityZone: instance.Placement?.AvailabilityZone ?? null,
          launchTime: instance.LaunchTime ?? null,
          privateIpAddress: instance.PrivateIpAddress ?? null,
          instanceType: instance.InstanceType ?? null,
          kubeletStatus,
        }
      })
    )

    return {
      clusterName,
      nodegroupName,
      instances,
    }
  }

  return {
    getNodegroupInstances,
    getInstanceSystemlog,
    getNodegroupInstancesWithKubeletStatus,
    parseKubeletStatus,
  }
}
