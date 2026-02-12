/**
 * Tests for aws/s3.ts - AWS S3 utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../../infrastructure/shell/index.js', () => ({
  aws: vi.fn(),
}));

vi.mock('../../../../framework/logging/index.js', () => ({
  log: {
    debug: vi.fn(),
    pass: vi.fn(),
    fail: vi.fn(),
  },
}));

vi.mock('../../../../infrastructure/aws/core.js', () => ({
  awsGetRegion: vi.fn().mockReturnValue('ap-northeast-1'),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    unlinkSync: vi.fn(),
  };
});

import { aws } from '../../../../infrastructure/shell/index.js';
import {
  s3BucketExists,
  s3ListBuckets,
  s3CreateBucket,
  s3BlockPublicAccess,
  s3EnableVersioning,
  s3GetBucketInfo,
  s3ListObjects,
  s3UploadString,
} from '../../../../infrastructure/aws/api/s3.js';

const mockAws = vi.mocked(aws);

describe('s3BucketExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when bucket exists', () => {
    mockAws.mockReturnValue('');
    expect(s3BucketExists('my-bucket')).toBe(true);
  });

  it('returns false when bucket does not exist', () => {
    mockAws.mockImplementation(() => {
      throw new Error('Not found');
    });
    expect(s3BucketExists('nonexistent')).toBe(false);
  });

  it('throws on invalid bucket name', () => {
    expect(() => s3BucketExists('bad bucket name')).toThrow();
  });
});

describe('s3ListBuckets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns list of buckets', () => {
    const buckets = {
      Buckets: [
        { Name: 'bucket1', CreationDate: '2024-01-01' },
        { Name: 'bucket2', CreationDate: '2024-01-02' },
      ],
    };
    mockAws.mockReturnValue(JSON.stringify(buckets));

    const result = s3ListBuckets();

    expect(result.Buckets).toHaveLength(2);
    expect(result.Buckets[0].Name).toBe('bucket1');
  });

  it('returns empty array on error', () => {
    mockAws.mockImplementation(() => {
      throw new Error('AWS error');
    });

    const result = s3ListBuckets();

    expect(result.Buckets).toEqual([]);
  });
});

describe('s3CreateBucket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates bucket successfully', () => {
    mockAws.mockReturnValue('');

    const result = s3CreateBucket('new-bucket');

    expect(result).toBe(true);
    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('s3api create-bucket --bucket new-bucket'),
      expect.any(Object)
    );
  });

  it('adds location constraint for non-us-east-1 regions', () => {
    mockAws.mockReturnValue('');

    s3CreateBucket('new-bucket', 'eu-west-1');

    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('LocationConstraint=eu-west-1'),
      expect.any(Object)
    );
  });

  it('returns false on error', () => {
    mockAws.mockImplementation(() => {
      throw new Error('Bucket already exists');
    });

    const result = s3CreateBucket('existing-bucket');

    expect(result).toBe(false);
  });
});

describe('s3BlockPublicAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks public access successfully', () => {
    mockAws.mockReturnValue('');

    const result = s3BlockPublicAccess('my-bucket');

    expect(result).toBe(true);
    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('put-public-access-block'),
      expect.any(Object)
    );
  });

  it('returns false on error', () => {
    mockAws.mockImplementation(() => {
      throw new Error('Access denied');
    });

    expect(s3BlockPublicAccess('my-bucket')).toBe(false);
  });
});

describe('s3EnableVersioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enables versioning successfully', () => {
    mockAws.mockReturnValue('');

    const result = s3EnableVersioning('my-bucket');

    expect(result).toBe(true);
    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('put-bucket-versioning'),
      expect.any(Object)
    );
  });

  it('returns false on error', () => {
    mockAws.mockImplementation(() => {
      throw new Error('Error');
    });

    expect(s3EnableVersioning('my-bucket')).toBe(false);
  });
});

describe('s3GetBucketInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns bucket info', () => {
    mockAws
      .mockReturnValueOnce('ap-northeast-1') // location
      .mockReturnValueOnce('Enabled') // versioning
      .mockReturnValueOnce(JSON.stringify({
        ServerSideEncryptionConfiguration: {
          Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }],
        },
      })); // encryption

    const result = s3GetBucketInfo('my-bucket');

    expect(result.name).toBe('my-bucket');
    expect(result.region).toBe('ap-northeast-1');
    expect(result.versioning).toBe('Enabled');
    expect(result.encryption).toBe('AES256');
  });

  it('handles us-east-1 region (None response)', () => {
    mockAws
      .mockReturnValueOnce('None')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('');

    const result = s3GetBucketInfo('my-bucket');

    expect(result.region).toBe('us-east-1');
  });

  it('handles errors gracefully', () => {
    mockAws.mockImplementation(() => {
      throw new Error('Error');
    });

    const result = s3GetBucketInfo('my-bucket');

    expect(result.name).toBe('my-bucket');
    expect(result.region).toBe('Unknown');
  });
});

describe('s3ListObjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns list of objects', () => {
    mockAws.mockReturnValue('2024-01-01 10:00 file1.txt\n2024-01-01 11:00 file2.txt');

    const result = s3ListObjects('my-bucket');

    expect(result).toHaveLength(2);
  });

  it('respects limit parameter', () => {
    mockAws.mockReturnValue('file1\nfile2\nfile3\nfile4\nfile5');

    const result = s3ListObjects('my-bucket', '', 3);

    expect(result).toHaveLength(3);
  });

  it('throws on invalid limit', () => {
    expect(() => s3ListObjects('my-bucket', '', -1)).toThrow('Invalid limit');
    expect(() => s3ListObjects('my-bucket', '', 0)).toThrow('Invalid limit');
  });

  it('returns empty array on error', () => {
    mockAws.mockImplementation(() => {
      throw new Error('Error');
    });

    expect(s3ListObjects('my-bucket')).toEqual([]);
  });
});

describe('s3UploadString', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads string content successfully', () => {
    mockAws.mockReturnValue('');

    const result = s3UploadString('my-bucket', 'path/to/file.txt', 'content');

    expect(result).toBe(true);
    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('s3 cp'),
      expect.any(Object)
    );
  });

  it('throws on null content', () => {
    expect(() =>
      s3UploadString('my-bucket', 'key', null as unknown as string)
    ).toThrow('Content is required');
  });

  it('returns false on upload error', () => {
    mockAws.mockImplementation(() => {
      throw new Error('Upload failed');
    });

    const result = s3UploadString('my-bucket', 'key', 'content');

    expect(result).toBe(false);
  });
});
