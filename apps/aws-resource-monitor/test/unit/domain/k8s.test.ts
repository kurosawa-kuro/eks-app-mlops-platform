import { describe, it, expect } from 'vitest'
import {
  isPodRestarting,
  isPodOOMKilled,
  isJobFailed,
  getAlertSeverity,
} from '../../../src/domain/entities/k8s.js'
import type { K8sPod, K8sJob } from '../../../src/domain/entities/k8s.js'

describe('isPodRestarting', () => {
  it('should return true when restartCount meets default threshold', () => {
    const pod = { restartCount: 3 } as K8sPod

    expect(isPodRestarting(pod)).toBe(true)
  })

  it('should return true when restartCount exceeds default threshold', () => {
    const pod = { restartCount: 5 } as K8sPod

    expect(isPodRestarting(pod)).toBe(true)
  })

  it('should return true when restartCount meets custom threshold', () => {
    const pod = { restartCount: 10 } as K8sPod

    expect(isPodRestarting(pod, 10)).toBe(true)
  })
})

describe('isPodOOMKilled', () => {
  it('should return true when a container has OOMKilled termination reason', () => {
    const pod = {
      containerStatuses: [
        { name: 'app', lastTerminationReason: 'OOMKilled' },
      ],
    } as K8sPod

    expect(isPodOOMKilled(pod)).toBe(true)
  })

  it('should return true when one of multiple containers is OOMKilled', () => {
    const pod = {
      containerStatuses: [
        { name: 'sidecar', lastTerminationReason: undefined },
        { name: 'app', lastTerminationReason: 'OOMKilled' },
      ],
    } as K8sPod

    expect(isPodOOMKilled(pod)).toBe(true)
  })
})

describe('isJobFailed', () => {
  it('should return true when job status is Failed', () => {
    const job = { status: 'Failed' } as K8sJob

    expect(isJobFailed(job)).toBe(true)
  })
})

describe('getAlertSeverity', () => {
  it('should return critical for oom_killed', () => {
    expect(getAlertSeverity('oom_killed')).toBe('critical')
  })

  it('should return critical for job_failed', () => {
    expect(getAlertSeverity('job_failed')).toBe('critical')
  })

  it('should return critical for node_not_ready', () => {
    expect(getAlertSeverity('node_not_ready')).toBe('critical')
  })

  it('should return warning for threshold_exceeded', () => {
    expect(getAlertSeverity('threshold_exceeded')).toBe('warning')
  })

  it('should return warning for pod_restart with low restartCount', () => {
    expect(getAlertSeverity('pod_restart', 3)).toBe('warning')
  })

  it('should return critical for pod_restart with restartCount >= 5', () => {
    expect(getAlertSeverity('pod_restart', 5)).toBe('critical')
  })
})
