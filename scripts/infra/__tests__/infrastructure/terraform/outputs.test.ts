/**
 * Tests for terraform/outputs.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('../../../infrastructure/shell/index.js', () => ({
  run: vi.fn(),
}));

import { execSync } from 'child_process';
import { run } from '../../../infrastructure/shell/index.js';
import { terraformOutput, createTerraformOutputs } from '../../../infrastructure/terraform/outputs.js';

const mockExecSync = vi.mocked(execSync);
const mockRun = vi.mocked(run);

describe('terraformOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns terraform output value', () => {
    mockRun.mockReturnValue('my-bucket');

    const result = terraformOutput('s3_bucket_name', '/path/to/terraform');

    expect(result).toBe('my-bucket');
    expect(mockRun).toHaveBeenCalledWith(
      'terraform -chdir=/path/to/terraform output -raw s3_bucket_name',
      { silent: true }
    );
  });

  it('returns null on error', () => {
    mockRun.mockImplementation(() => {
      throw new Error('Output not found');
    });

    const result = terraformOutput('nonexistent', '/path/to/terraform');

    expect(result).toBeNull();
  });
});

describe('createTerraformOutputs', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates output getters', () => {
    mockExecSync.mockReturnValue('value');

    const outputs = createTerraformOutputs('/tf/dir');

    expect(outputs.get).toBeDefined();
    expect(outputs.s3Bucket).toBeDefined();
    expect(outputs.apiUrl).toBeDefined();
    expect(outputs.bastionId).toBeDefined();
  });

  it('caches output values', () => {
    mockExecSync.mockReturnValue('cached-value');

    const outputs = createTerraformOutputs('/tf/dir');

    // Call twice
    outputs.get('test_key');
    outputs.get('test_key');

    // Should only call execSync once due to caching
    expect(mockExecSync).toHaveBeenCalledTimes(1);
  });

  it('returns null for missing outputs', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Output not found');
    });

    const outputs = createTerraformOutputs('/tf/dir');
    const result = outputs.get('nonexistent');

    expect(result).toBeNull();
  });

  it('falls back to environment variables for s3Bucket', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Not found');
    });
    process.env.S3_BUCKET = 'env-bucket';

    const outputs = createTerraformOutputs('/tf/dir');
    const result = outputs.s3Bucket();

    expect(result).toBe('env-bucket');
  });

  it('falls back to environment variables for apiUrl', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Not found');
    });
    process.env.API_URL = 'https://env-api.example.com';

    const outputs = createTerraformOutputs('/tf/dir');
    const result = outputs.apiUrl();

    expect(result).toBe('https://env-api.example.com');
  });

  it('returns terraform output for specific getters', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('cluster_name')) return 'my-cluster';
      if (cmd.includes('vpc_id')) return 'vpc-12345';
      throw new Error('Not found');
    });

    const outputs = createTerraformOutputs('/tf/dir');

    expect(outputs.clusterName()).toBe('my-cluster');
    expect(outputs.vpcId()).toBe('vpc-12345');
  });
});
