/**
 * In-Memory Cache Service with TTL support
 * AWS Resource Monitorのキャッシュ管理
 */

export interface CacheEntry<T> {
  data: T
  timestamp: Date
  ttlMs: number
}

export interface CacheService {
  get<T>(key: string): T | null
  set<T>(key: string, data: T, ttlMs?: number): void
  invalidate(key: string): void
  invalidateByPrefix(prefix: string): void
  invalidateAll(): void
  getLastUpdated(key: string): Date | null
  has(key: string): boolean
  keys(): string[]
}

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

export function createMemoryCacheService(defaultTtlMs: number = DEFAULT_TTL_MS): CacheService {
  const cache = new Map<string, CacheEntry<unknown>>()

  function isExpired(entry: CacheEntry<unknown>): boolean {
    const now = Date.now()
    const expiresAt = entry.timestamp.getTime() + entry.ttlMs
    return now > expiresAt
  }

  return {
    get<T>(key: string): T | null {
      const entry = cache.get(key)
      if (!entry) return null
      if (isExpired(entry)) {
        cache.delete(key)
        return null
      }
      return entry.data as T
    },

    set<T>(key: string, data: T, ttlMs: number = defaultTtlMs): void {
      cache.set(key, {
        data,
        timestamp: new Date(),
        ttlMs
      })
    },

    invalidate(key: string): void {
      cache.delete(key)
    },

    invalidateByPrefix(prefix: string): void {
      for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
          cache.delete(key)
        }
      }
    },

    invalidateAll(): void {
      cache.clear()
    },

    getLastUpdated(key: string): Date | null {
      const entry = cache.get(key)
      if (!entry) return null
      if (isExpired(entry)) {
        cache.delete(key)
        return null
      }
      return entry.timestamp
    },

    has(key: string): boolean {
      const entry = cache.get(key)
      if (!entry) return false
      if (isExpired(entry)) {
        cache.delete(key)
        return false
      }
      return true
    },

    keys(): string[] {
      const validKeys: string[] = []
      for (const [key, entry] of cache.entries()) {
        if (isExpired(entry)) {
          cache.delete(key)
        } else {
          validKeys.push(key)
        }
      }
      return validKeys
    }
  }
}
