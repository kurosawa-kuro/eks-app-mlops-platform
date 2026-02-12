import { describe, it, expect } from 'vitest'
import {
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  RESOURCE_CATEGORY_TYPES,
  RESOURCE_CATEGORY_LABELS,
  HIGH_COST_CRITICAL_TYPES,
  HIGH_COST_WARNING_TYPES,
  ALL_HIGH_COST_TYPES,
  isEksRelatedType,
  isHighCostAlertTarget,
  getHighCostLevel,
  getResourceCategory
} from '../../../src/domain/entities/resource.js'

describe('Resource Entity', () => {
  it('should have 30 resource types defined', () => {
    expect(RESOURCE_TYPES.length).toBe(30)
  })
})

describe('Resource Type Labels', () => {
  it('should have labels for all resource types', () => {
    for (const type of RESOURCE_TYPES) {
      expect(RESOURCE_TYPE_LABELS[type]).toBeDefined()
    }
  })
})

describe('isEksRelatedType', () => {
  it('should return true for eks type', () => {
    expect(isEksRelatedType('eks')).toBe(true)
  })

  it('should return true for nodegroup type', () => {
    expect(isEksRelatedType('nodegroup')).toBe(true)
  })

  it('should return true for eksaddon type', () => {
    expect(isEksRelatedType('eksaddon')).toBe(true)
  })

  it('should return true for ec2 type (included in eks-related for monitoring)', () => {
    expect(isEksRelatedType('ec2')).toBe(true)
  })

  it('should return false for s3 type', () => {
    expect(isEksRelatedType('s3')).toBe(false)
  })
})

describe('RESOURCE_CATEGORY_TYPES', () => {
  it('should have 8 categories defined', () => {
    const categories = Object.keys(RESOURCE_CATEGORY_TYPES)
    expect(categories.length).toBe(8)
  })
})

describe('RESOURCE_CATEGORY_LABELS', () => {
  it('should have labels for all categories', () => {
    const categories = Object.keys(RESOURCE_CATEGORY_TYPES)
    for (const category of categories) {
      expect(RESOURCE_CATEGORY_LABELS[category as keyof typeof RESOURCE_CATEGORY_LABELS]).toBeDefined()
    }
  })
})

describe('HIGH_COST_CRITICAL_TYPES', () => {
  it('should include eks', () => {
    expect(HIGH_COST_CRITICAL_TYPES).toContain('eks')
  })

  it('should include ec2', () => {
    expect(HIGH_COST_CRITICAL_TYPES).toContain('ec2')
  })

  it('should include natgateway', () => {
    expect(HIGH_COST_CRITICAL_TYPES).toContain('natgateway')
  })
})

describe('HIGH_COST_WARNING_TYPES', () => {
  it('should include eip', () => {
    expect(HIGH_COST_WARNING_TYPES).toContain('eip')
  })

  it('should include targetgroup', () => {
    expect(HIGH_COST_WARNING_TYPES).toContain('targetgroup')
  })
})

describe('ALL_HIGH_COST_TYPES', () => {
  it('should contain all critical and warning types', () => {
    for (const type of HIGH_COST_CRITICAL_TYPES) {
      expect(ALL_HIGH_COST_TYPES).toContain(type)
    }
    for (const type of HIGH_COST_WARNING_TYPES) {
      expect(ALL_HIGH_COST_TYPES).toContain(type)
    }
  })
})

describe('isHighCostAlertTarget', () => {
  it('should return true for eks cluster', () => {
    expect(isHighCostAlertTarget('eks', 'ACTIVE')).toBe(true)
  })

  it('should return true for running ec2', () => {
    expect(isHighCostAlertTarget('ec2', 'running')).toBe(true)
  })

  it('should return true for available ebs (unused volume)', () => {
    expect(isHighCostAlertTarget('ebs', 'available')).toBe(true)
  })

  it('should return true for in-use ebs (both available and in-use are monitored)', () => {
    expect(isHighCostAlertTarget('ebs', 'in-use')).toBe(true)
  })

  it('should return false for deleted ebs', () => {
    expect(isHighCostAlertTarget('ebs', 'deleted')).toBe(false)
  })

  it('should return true for unassociated eip', () => {
    expect(isHighCostAlertTarget('eip', 'available')).toBe(true)
  })

  it('should return false for associated eip', () => {
    expect(isHighCostAlertTarget('eip', 'associated')).toBe(false)
  })

  it('should return false for s3 bucket', () => {
    expect(isHighCostAlertTarget('s3', 'active')).toBe(false)
  })
})

describe('getHighCostLevel', () => {
  it('should return critical for eks', () => {
    expect(getHighCostLevel('eks')).toBe('critical')
  })

  it('should return critical for natgateway', () => {
    expect(getHighCostLevel('natgateway')).toBe('critical')
  })

  it('should return warning for eip', () => {
    expect(getHighCostLevel('eip')).toBe('warning')
  })

  it('should return null for s3', () => {
    expect(getHighCostLevel('s3')).toBeNull()
  })
})

describe('getResourceCategory', () => {
  it('should return compute for ec2', () => {
    expect(getResourceCategory('ec2')).toBe('eks-related')
  })

  it('should return storage for s3', () => {
    expect(getResourceCategory('s3')).toBe('storage')
  })

  it('should return database for rds', () => {
    expect(getResourceCategory('rds')).toBe('database')
  })

  it('should return networking for vpc', () => {
    expect(getResourceCategory('vpc')).toBe('networking')
  })

  it('should return security for iamrole', () => {
    expect(getResourceCategory('iamrole')).toBe('eks-related')
  })

  it('should return dns-certificates for route53zone', () => {
    expect(getResourceCategory('route53zone')).toBe('dns-certificates')
  })

  it('should return logging-messaging for sqsqueue', () => {
    expect(getResourceCategory('sqsqueue')).toBe('logging-messaging')
  })
})
