import { describe, it, expect } from 'vitest'
import { appConfigSchema } from '../../../src/env/schema.js'

describe('appConfigSchema', () => {
  it('should parse valid config with all defaults', () => {
    const result = appConfigSchema.safeParse({})

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.port).toBe(8001)
      expect(result.data.appEnv).toBe('local')
      expect(result.data.appMode).toBe('origin')
    }
  })

  it('should apply defaults for optional fields', () => {
    const result = appConfigSchema.safeParse({})

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.projectName).toBe('aws-resource-monitor')
      expect(result.data.logLevel).toBe('info')
      expect(result.data.alertEnabled).toBe(false)
      expect(result.data.awsRegion).toBe('ap-northeast-1')
    }
  })

  it('should convert string boolean to boolean', () => {
    const result = appConfigSchema.safeParse({
      alertEnabled: 'true'
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.alertEnabled).toBe(true)
    }
  })

  it('should parse custom port and env', () => {
    const result = appConfigSchema.safeParse({
      port: '8080',
      appEnv: 'production'
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.port).toBe(8080)
      expect(result.data.appEnv).toBe('production')
    }
  })

  it('should parse AWS region', () => {
    const result = appConfigSchema.safeParse({
      awsRegion: 'us-east-1'
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.awsRegion).toBe('us-east-1')
    }
  })
})
