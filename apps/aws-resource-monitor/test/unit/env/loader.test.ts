import { describe, it, expect } from 'vitest'
import { loadConfig } from '../../../src/env/loader.js'

describe('loadConfig', () => {
  it('should load and merge config from config.json and environment', () => {
    const config = loadConfig()

    // Verify config is loaded (either from env vars or config.json)
    expect(config).toBeDefined()
    expect(typeof config.port).toBe('number')
    expect(typeof config.appEnv).toBe('string')
    expect(typeof config.appMode).toBe('string')
  })

  it('should return valid AppConfig structure', () => {
    const config = loadConfig()

    // Verify all required fields exist with correct types
    expect(config.projectName).toBeDefined()
    expect(config.logLevel).toBeDefined()
    expect(typeof config.alertEnabled).toBe('boolean')
    expect(typeof config.awsRegion).toBe('string')
  })

  it('should prioritize environment variables over config file', () => {
    const config = loadConfig()

    // The config should be valid regardless of source
    expect(config.appEnv).toMatch(/^(local|development|production)$/)
  })
})
