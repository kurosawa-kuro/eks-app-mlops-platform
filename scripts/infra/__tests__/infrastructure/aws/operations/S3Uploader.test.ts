/**
 * Tests for classes/S3Uploader.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../../infrastructure/shell/index.js', () => ({
  aws: vi.fn(),
}));

vi.mock('../../../../framework/logging/index.js', () => ({
  log: {
    info: vi.fn(),
    pass: vi.fn(),
    fail: vi.fn(),
  },
}));

vi.mock('../../../../framework/logging/colors.js', () => ({
  c: {
    dim: (s: string) => s,
  },
}));

vi.mock('../../../../infrastructure/aws/core.js', () => ({
  awsGetRegion: vi.fn().mockReturnValue('ap-northeast-1'),
}));

import { aws } from '../../../../infrastructure/shell/index.js';
import { S3Uploader } from '../../../../infrastructure/aws/operations/S3Uploader.js';

const mockAws = vi.mocked(aws);

describe('S3Uploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('creates uploader with bucket and prefix', () => {
      const uploader = new S3Uploader('my-bucket', 'manifests');
      expect(uploader.bucket).toBe('my-bucket');
      expect(uploader.prefix).toBe('manifests');
      expect(uploader.region).toBe('ap-northeast-1');
    });

    it('uses provided region', () => {
      const uploader = new S3Uploader('my-bucket', 'prefix', 'us-west-2');
      expect(uploader.region).toBe('us-west-2');
    });
  });

  describe('upload', () => {
    it('uploads directory successfully', () => {
      mockAws.mockReturnValue('upload: file1.yaml\nupload: file2.yaml');

      const uploader = new S3Uploader('my-bucket', 'manifests');
      const result = uploader.upload('/path/to/source');

      expect(result).toBe(true);
      expect(mockAws).toHaveBeenCalledWith(
        's3 sync /path/to/source s3://my-bucket/manifests/ --delete',
        expect.objectContaining({ region: 'ap-northeast-1' })
      );
    });

    it('returns false on upload failure', () => {
      mockAws.mockImplementation(() => {
        throw new Error('Access denied');
      });

      const uploader = new S3Uploader('my-bucket', 'manifests');
      const result = uploader.upload('/path/to/source');

      expect(result).toBe(false);
    });
  });

  describe('listFiles', () => {
    it('lists uploaded files', () => {
      mockAws.mockReturnValue('2024-01-01 10:00 file1.yaml\n2024-01-01 11:00 file2.yaml');

      const uploader = new S3Uploader('my-bucket', 'manifests');
      uploader.listFiles();

      expect(mockAws).toHaveBeenCalledWith(
        's3 ls s3://my-bucket/manifests/ --recursive',
        expect.objectContaining({ region: 'ap-northeast-1' })
      );
    });

    it('respects limit parameter', () => {
      const lines = Array(20).fill('2024-01-01 10:00 file.yaml').join('\n');
      mockAws.mockReturnValue(lines);

      const uploader = new S3Uploader('my-bucket', 'manifests');
      uploader.listFiles(5);

      // Just verifies no errors are thrown
      expect(mockAws).toHaveBeenCalled();
    });

    it('handles errors silently', () => {
      mockAws.mockImplementation(() => {
        throw new Error('Error');
      });

      const uploader = new S3Uploader('my-bucket', 'manifests');

      // Should not throw
      expect(() => uploader.listFiles()).not.toThrow();
    });
  });
});
