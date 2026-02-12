import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMemoryCacheService } from '../../../src/infra/cache/memoryCache.js'

describe('MemoryCacheService', () => {
  it('should set and get cached value', () => {
    const cache = createMemoryCacheService(60000)

    cache.set('test-key', { data: 'test-value' })
    const result = cache.get<{ data: string }>('test-key')

    expect(result).toEqual({ data: 'test-value' })
  })

  it('should return null for non-existent key', () => {
    const cache = createMemoryCacheService(60000)

    const result = cache.get('non-existent')

    expect(result).toBeNull()
  })

  it('should expire cached value after TTL', () => {
    vi.useFakeTimers()
    const cache = createMemoryCacheService(1000)

    cache.set('test-key', { data: 'test-value' })

    // Advance time past TTL
    vi.advanceTimersByTime(1001)

    const result = cache.get('test-key')
    expect(result).toBeNull()

    vi.useRealTimers()
  })

  it('should invalidate single key', () => {
    const cache = createMemoryCacheService(60000)

    cache.set('key1', 'value1')
    cache.set('key2', 'value2')

    cache.invalidate('key1')

    expect(cache.get('key1')).toBeNull()
    expect(cache.get('key2')).toBe('value2')
  })

  it('should invalidate by prefix', () => {
    const cache = createMemoryCacheService(60000)

    cache.set('resources:ec2', 'ec2-data')
    cache.set('resources:s3', 's3-data')
    cache.set('costs:monthly', 'cost-data')

    cache.invalidateByPrefix('resources:')

    expect(cache.get('resources:ec2')).toBeNull()
    expect(cache.get('resources:s3')).toBeNull()
    expect(cache.get('costs:monthly')).toBe('cost-data')
  })

  it('should invalidate all', () => {
    const cache = createMemoryCacheService(60000)

    cache.set('key1', 'value1')
    cache.set('key2', 'value2')

    cache.invalidateAll()

    expect(cache.get('key1')).toBeNull()
    expect(cache.get('key2')).toBeNull()
  })

  it('should track last updated time', () => {
    const cache = createMemoryCacheService(60000)

    cache.set('test-key', 'test-value')
    const lastUpdated = cache.getLastUpdated('test-key')

    expect(lastUpdated).toBeInstanceOf(Date)
  })

  it('should return null for last updated of non-existent key', () => {
    const cache = createMemoryCacheService(60000)

    const lastUpdated = cache.getLastUpdated('non-existent')

    expect(lastUpdated).toBeNull()
  })

  it('should check if key exists with has()', () => {
    const cache = createMemoryCacheService(60000)

    cache.set('test-key', 'test-value')

    expect(cache.has('test-key')).toBe(true)
    expect(cache.has('non-existent')).toBe(false)
  })

  it('should return all valid keys', () => {
    const cache = createMemoryCacheService(60000)

    cache.set('key1', 'value1')
    cache.set('key2', 'value2')

    const keys = cache.keys()

    expect(keys).toContain('key1')
    expect(keys).toContain('key2')
    expect(keys.length).toBe(2)
  })
})
