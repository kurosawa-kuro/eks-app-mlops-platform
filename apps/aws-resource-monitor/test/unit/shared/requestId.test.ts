import { describe, it, expect } from 'vitest'
import { generateRequestId } from '../../../src/shared/requestId.js'

describe('generateRequestId', () => {
  it('should generate id with correct format', () => {
    const id = generateRequestId()

    expect(id).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/)
  })

  it('should generate unique ids', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateRequestId())
    }

    expect(ids.size).toBe(100)
  })
})
