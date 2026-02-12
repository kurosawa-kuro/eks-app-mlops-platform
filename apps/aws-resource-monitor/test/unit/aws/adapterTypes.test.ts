import { describe, it, expect } from 'vitest'
import { extractTags } from '../../../src/infra/aws/adapters/types.js'

describe('extractTags', () => {
  it('should extract tags from AWS tag array', () => {
    const tags = [
      { Key: 'Name', Value: 'my-instance' },
      { Key: 'Environment', Value: 'production' },
    ]
    const result = extractTags(tags)
    expect(result).toEqual({
      Name: 'my-instance',
      Environment: 'production',
    })
  })

  it('should return empty object for undefined tags', () => {
    expect(extractTags(undefined)).toEqual({})
  })

  it('should return empty object for empty array', () => {
    expect(extractTags([])).toEqual({})
  })

  it('should handle tags with undefined Value', () => {
    const tags = [{ Key: 'Name', Value: undefined }]
    const result = extractTags(tags)
    expect(result).toEqual({ Name: '' })
  })

  it('should skip tags with undefined Key', () => {
    const tags = [{ Key: undefined, Value: 'value' }]
    const result = extractTags(tags)
    expect(result).toEqual({})
  })
})
