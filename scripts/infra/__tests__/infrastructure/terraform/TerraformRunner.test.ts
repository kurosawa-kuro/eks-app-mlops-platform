import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerraformRunner } from '../../../infrastructure/terraform/TerraformRunner.js';
import type { TerraformRunnerDependencies } from '../../../infrastructure/terraform/TerraformRunner.js';

describe('TerraformRunner', () => {
  const mockDeps: TerraformRunnerDependencies = {
    run: vi.fn(),
    runStreaming: vi.fn(),
    log: {
      info: vi.fn(),
      pass: vi.fn(),
      fail: vi.fn(),
      warn: vi.fn(),
      skip: vi.fn(),
      dryRun: vi.fn(),
      debug: vi.fn(),
      section: vi.fn(),
      header: vi.fn(),
      phase: vi.fn(),
      status: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOutputs', () => {
    it('should parse terraform outputs', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
        if (cmd.includes('cluster_name')) return 'test-cluster';
        if (cmd.includes('cluster_endpoint')) return 'https://endpoint.eks.aws';
        if (cmd.includes('vpc_id')) return 'vpc-12345';
        return '';
      });

      const runner = new TerraformRunner('/path/to/tf', mockDeps);
      const outputs = runner.getOutputs();

      expect(outputs.clusterName).toBe('test-cluster');
      expect(outputs.clusterEndpoint).toBe('https://endpoint.eks.aws');
      expect(outputs.vpcId).toBe('vpc-12345');
    });

    it('should handle missing outputs', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const runner = new TerraformRunner('/path/to/tf', mockDeps);
      const outputs = runner.getOutputs();

      expect(outputs.clusterName).toBeNull();
      expect(outputs.clusterEndpoint).toBeNull();
    });
  });

  describe('init', () => {
    it('should run terraform init successfully', async () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue('');

      const runner = new TerraformRunner('/path/to/tf', mockDeps);
      const result = await runner.init();

      expect(result).toBe(true);
      expect(mockDeps.run).toHaveBeenCalledWith('terraform init', { cwd: '/path/to/tf' });
      expect(mockDeps.log.pass).toHaveBeenCalledWith('Terraform initialized');
    });

    it('should return false on init failure', async () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Init failed');
      });

      const runner = new TerraformRunner('/path/to/tf', mockDeps);
      const result = await runner.init();

      expect(result).toBe(false);
      expect(mockDeps.log.fail).toHaveBeenCalledWith('Terraform init failed');
    });
  });

  describe('apply', () => {
    it('should run terraform apply successfully', async () => {
      (mockDeps.runStreaming as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const runner = new TerraformRunner('/path/to/tf', mockDeps);
      const result = await runner.apply();

      expect(result).toBe(true);
      expect(mockDeps.runStreaming).toHaveBeenCalledWith('terraform', ['apply', '-auto-approve'], '/path/to/tf');
    });

    it('should return false on apply failure', async () => {
      (mockDeps.runStreaming as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Apply failed'));

      const runner = new TerraformRunner('/path/to/tf', mockDeps);
      const result = await runner.apply();

      expect(result).toBe(false);
    });
  });

  describe('isInitialized', () => {
    it('should return true if .terraform exists', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue('drwxr-xr-x');

      const runner = new TerraformRunner('/path/to/tf', mockDeps);
      const result = runner.isInitialized();

      expect(result).toBe(true);
    });

    it('should return false if .terraform does not exist', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const runner = new TerraformRunner('/path/to/tf', mockDeps);
      const result = runner.isInitialized();

      expect(result).toBe(false);
    });
  });

  describe('stateList', () => {
    it('should return array of resources', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue('aws_eks_cluster.main\naws_vpc.main\n');

      const runner = new TerraformRunner('/path/to/tf', mockDeps);
      const result = runner.stateList();

      expect(result).toEqual(['aws_eks_cluster.main', 'aws_vpc.main']);
    });

    it('should return empty array on failure', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const runner = new TerraformRunner('/path/to/tf', mockDeps);
      const result = runner.stateList();

      expect(result).toEqual([]);
    });
  });
});
