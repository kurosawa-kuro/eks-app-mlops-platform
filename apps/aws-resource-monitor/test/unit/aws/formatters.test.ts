import { describe, it, expect } from 'vitest'
import {
  formatLastUpdated,
  getStatusClass,
  getStatusLabel,
  getCostClass,
  getCostBadge
} from '../../../src/presentation/helpers/awsFormatters.js'
import type { ResourceType } from '../../../src/domain/entities/resource.js'

describe('formatLastUpdated', () => {
  it('should return formatted time for first valid date', () => {
    const map = new Map<ResourceType, Date | null>([
      ['ec2', new Date('2025-01-15T10:30:00')],
      ['s3', null]
    ])

    const result = formatLastUpdated(map)

    expect(result).toMatch(/^\d{1,2}:\d{2}:\d{2}$/)
  })

  it('should return null when all dates are null', () => {
    const map = new Map<ResourceType, Date | null>([
      ['ec2', null],
      ['s3', null]
    ])

    const result = formatLastUpdated(map)

    expect(result).toBeNull()
  })

  it('should return null for empty map', () => {
    const map = new Map<ResourceType, Date | null>()

    const result = formatLastUpdated(map)

    expect(result).toBeNull()
  })
})

describe('getStatusClass', () => {
  it('should return status-ok for running state', () => {
    expect(getStatusClass('running')).toBe('status-ok')
  })

  it('should return status-ok for available state', () => {
    expect(getStatusClass('available')).toBe('status-ok')
  })

  it('should return status-ok for active state', () => {
    expect(getStatusClass('active')).toBe('status-ok')
  })

  it('should return status-pending for pending state', () => {
    expect(getStatusClass('pending')).toBe('status-pending')
  })

  it('should return status-pending for creating state', () => {
    expect(getStatusClass('creating')).toBe('status-pending')
  })

  it('should return status-warning for stopping state', () => {
    expect(getStatusClass('stopping')).toBe('status-warning')
  })

  it('should return status-error for failed state', () => {
    expect(getStatusClass('failed')).toBe('status-error')
  })

  it('should return status-error for terminated state', () => {
    expect(getStatusClass('terminated')).toBe('status-error')
  })

  it('should return status-inactive for unknown state', () => {
    expect(getStatusClass('unknown')).toBe('status-inactive')
  })

  it('should return status-inactive for null state', () => {
    expect(getStatusClass(null)).toBe('status-inactive')
  })

  it('should return status-inactive for undefined state', () => {
    expect(getStatusClass(undefined)).toBe('status-inactive')
  })
})

describe('getStatusLabel', () => {
  it('should capitalize first letter', () => {
    expect(getStatusLabel('running')).toBe('Running')
  })

  it('should handle uppercase input', () => {
    expect(getStatusLabel('PENDING')).toBe('Pending')
  })

  it('should return Unknown for null', () => {
    expect(getStatusLabel(null)).toBe('Unknown')
  })

  it('should return Unknown for undefined', () => {
    expect(getStatusLabel(undefined)).toBe('Unknown')
  })
})

describe('getCostClass', () => {
  const criticalTypes: ResourceType[] = ['eks', 'ec2', 'natgateway']
  const warningTypes: ResourceType[] = ['eip', 'targetgroup']

  it('should return cost-critical for critical types', () => {
    expect(getCostClass('eks', criticalTypes, warningTypes)).toBe('cost-critical')
    expect(getCostClass('ec2', criticalTypes, warningTypes)).toBe('cost-critical')
    expect(getCostClass('natgateway', criticalTypes, warningTypes)).toBe('cost-critical')
  })

  it('should return cost-warning for warning types', () => {
    expect(getCostClass('eip', criticalTypes, warningTypes)).toBe('cost-warning')
    expect(getCostClass('targetgroup', criticalTypes, warningTypes)).toBe('cost-warning')
  })

  it('should return empty string for normal types', () => {
    expect(getCostClass('s3', criticalTypes, warningTypes)).toBe('')
    expect(getCostClass('vpc', criticalTypes, warningTypes)).toBe('')
  })
})

describe('getCostBadge', () => {
  const criticalTypes: ResourceType[] = ['eks', 'ec2']
  const warningTypes: ResourceType[] = ['eip', 'targetgroup']

  it('should return S badge for critical types', () => {
    const badge = getCostBadge('eks', criticalTypes, warningTypes)
    expect(badge).toContain('S')
    expect(badge).toContain('critical')
  })

  it('should return A badge for warning types', () => {
    const badge = getCostBadge('eip', criticalTypes, warningTypes)
    expect(badge).toContain('A')
    expect(badge).toContain('warning')
  })

  it('should return empty string for normal types', () => {
    expect(getCostBadge('s3', criticalTypes, warningTypes)).toBe('')
  })
})
