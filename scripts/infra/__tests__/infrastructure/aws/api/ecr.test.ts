/**
 * Tests for aws/ecr.ts - AWS ECR utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

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

import { execSync } from 'child_process';
import { aws } from '../../../../infrastructure/shell/index.js';
import {
  ecrGetRegistryUrl,
  ecrDockerLogin,
  ecrListRepositories,
  ecrRepositoryExists,
  ecrCreateRepository,
  ecrListImages,
  ecrSetLifecyclePolicy,
} from '../../../../infrastructure/aws/api/ecr.js';

const mockExecSync = vi.mocked(execSync);
const mockAws = vi.mocked(aws);

describe('ecrGetRegistryUrl', () => {
  it('returns correct registry URL', () => {
    const url = ecrGetRegistryUrl('123456789012', 'us-east-1');
    expect(url).toBe('123456789012.dkr.ecr.us-east-1.amazonaws.com');
  });

  it('works with different regions', () => {
    const url = ecrGetRegistryUrl('111111111111', 'ap-northeast-1');
    expect(url).toBe('111111111111.dkr.ecr.ap-northeast-1.amazonaws.com');
  });
});

describe('ecrDockerLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs in successfully', () => {
    mockExecSync.mockReturnValue(Buffer.from('Login Succeeded'));

    const result = ecrDockerLogin('us-east-1', '123456789012');

    expect(result).toBe(true);
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('docker login'),
      expect.any(Object)
    );
  });

  it('returns false on login failure', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Login failed');
    });

    const result = ecrDockerLogin('us-east-1', '123456789012');

    expect(result).toBe(false);
  });
});

describe('ecrListRepositories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns list of repositories', () => {
    const repos = [
      ['repo1', 'uri1', '2024-01-01'],
      ['repo2', 'uri2', '2024-01-02'],
    ];
    mockAws.mockReturnValue(JSON.stringify(repos));

    const result = ecrListRepositories();

    expect(result).toHaveLength(2);
    expect(result[0][0]).toBe('repo1');
  });

  it('returns empty array on error', () => {
    mockAws.mockImplementation(() => {
      throw new Error('Error');
    });

    expect(ecrListRepositories()).toEqual([]);
  });

  it('uses provided region', () => {
    mockAws.mockReturnValue('[]');

    ecrListRepositories('eu-west-1');

    expect(mockAws).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ region: 'eu-west-1' })
    );
  });
});

describe('ecrRepositoryExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when repository exists', () => {
    mockAws.mockReturnValue('{}');

    expect(ecrRepositoryExists('my-repo')).toBe(true);
  });

  it('returns false when repository does not exist', () => {
    mockAws.mockImplementation(() => {
      throw new Error('RepositoryNotFoundException');
    });

    expect(ecrRepositoryExists('nonexistent')).toBe(false);
  });

  it('throws on invalid repository name', () => {
    expect(() => ecrRepositoryExists('bad repo name')).toThrow();
  });
});

describe('ecrCreateRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates repository and returns result', () => {
    const response = {
      repository: {
        repositoryName: 'my-repo',
        repositoryUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-repo',
        repositoryArn: 'arn:aws:ecr:us-east-1:123456789012:repository/my-repo',
      },
    };
    mockAws.mockReturnValue(JSON.stringify(response));

    const result = ecrCreateRepository('my-repo');

    expect(result.repository).toBeDefined();
    expect(result.repository?.repositoryName).toBe('my-repo');
    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('ecr create-repository --repository-name my-repo'),
      expect.any(Object)
    );
  });

  it('enables image scanning on push', () => {
    mockAws.mockReturnValue('{}');

    ecrCreateRepository('my-repo');

    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('scanOnPush=true'),
      expect.any(Object)
    );
  });
});

describe('ecrListImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns list of images', () => {
    const images = [
      { imageDigest: 'sha256:abc', imageTags: ['latest'] },
      { imageDigest: 'sha256:def', imageTags: ['v1.0'] },
    ];
    mockAws.mockReturnValue(JSON.stringify(images));

    const result = ecrListImages('my-repo');

    expect(result).toHaveLength(2);
  });

  it('returns empty array on error', () => {
    mockAws.mockImplementation(() => {
      throw new Error('Error');
    });

    expect(ecrListImages('my-repo')).toEqual([]);
  });
});

describe('ecrSetLifecyclePolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets lifecycle policy successfully', () => {
    mockAws.mockReturnValue('');

    const result = ecrSetLifecyclePolicy('my-repo');

    expect(result).toBe(true);
    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('put-lifecycle-policy'),
      expect.any(Object)
    );
  });

  it('uses custom maxImages value', () => {
    mockAws.mockReturnValue('');

    ecrSetLifecyclePolicy('my-repo', undefined, 20);

    expect(mockAws).toHaveBeenCalledWith(
      expect.stringContaining('"countNumber":20'),
      expect.any(Object)
    );
  });

  it('returns false on error', () => {
    mockAws.mockImplementation(() => {
      throw new Error('Error');
    });

    expect(ecrSetLifecyclePolicy('my-repo')).toBe(false);
  });
});
