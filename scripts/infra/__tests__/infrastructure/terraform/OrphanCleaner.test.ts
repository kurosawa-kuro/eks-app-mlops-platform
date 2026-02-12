import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrphanCleaner } from '../../../infrastructure/terraform/OrphanCleaner.js';
import type { OrphanCleanerDependencies } from '../../../infrastructure/terraform/OrphanCleaner.js';

describe('OrphanCleaner', () => {
  const mockDeps: OrphanCleanerDependencies = {
    run: vi.fn(),
    aws: vi.fn(),
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

  describe('isInTerraformState', () => {
    it('should return true when log groups are in state', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue('aws_cloudwatch_log_group.vpc_flow_logs');

      const cleaner = new OrphanCleaner({ tfDir: '/path/to/tf', region: 'ap-northeast-1' }, mockDeps);
      const result = cleaner.isInTerraformState('/k8s-ml-platform/prod/vpc-flow-logs');

      expect(result).toBe(true);
    });

    it('should return false when no log groups in state', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue('aws_vpc.main');

      const cleaner = new OrphanCleaner({ tfDir: '/path/to/tf', region: 'ap-northeast-1' }, mockDeps);
      const result = cleaner.isInTerraformState('/k8s-ml-platform/prod/vpc-flow-logs');

      expect(result).toBe(false);
    });

    it('should return false on state list failure', () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const cleaner = new OrphanCleaner({ tfDir: '/path/to/tf', region: 'ap-northeast-1' }, mockDeps);
      const result = cleaner.isInTerraformState('/k8s-ml-platform/prod/vpc-flow-logs');

      expect(result).toBe(false);
    });
  });

  describe('existsInAws', () => {
    it('should return true when log group exists', () => {
      (mockDeps.aws as ReturnType<typeof vi.fn>).mockReturnValue('/k8s-ml-platform/prod/vpc-flow-logs');

      const cleaner = new OrphanCleaner({ tfDir: '/path/to/tf', region: 'ap-northeast-1' }, mockDeps);
      const result = cleaner.existsInAws('/k8s-ml-platform/prod/vpc-flow-logs');

      expect(result).toBe(true);
    });

    it('should return false when log group does not exist', () => {
      (mockDeps.aws as ReturnType<typeof vi.fn>).mockReturnValue('None');

      const cleaner = new OrphanCleaner({ tfDir: '/path/to/tf', region: 'ap-northeast-1' }, mockDeps);
      const result = cleaner.existsInAws('/k8s-ml-platform/prod/vpc-flow-logs');

      expect(result).toBe(false);
    });

    it('should return false on empty result', () => {
      (mockDeps.aws as ReturnType<typeof vi.fn>).mockReturnValue('');

      const cleaner = new OrphanCleaner({ tfDir: '/path/to/tf', region: 'ap-northeast-1' }, mockDeps);
      const result = cleaner.existsInAws('/k8s-ml-platform/prod/vpc-flow-logs');

      expect(result).toBe(false);
    });
  });

  describe('deleteLogGroup', () => {
    it('should delete log group successfully', () => {
      const cleaner = new OrphanCleaner({ tfDir: '/path/to/tf', region: 'ap-northeast-1' }, mockDeps);
      const result = cleaner.deleteLogGroup('/k8s-ml-platform/prod/vpc-flow-logs');

      expect(result).toBe(true);
      expect(mockDeps.aws).toHaveBeenCalledWith(
        'logs delete-log-group --log-group-name "/k8s-ml-platform/prod/vpc-flow-logs"',
        { region: 'ap-northeast-1' }
      );
      expect(mockDeps.log.pass).toHaveBeenCalled();
    });

    it('should return false on delete failure', () => {
      (mockDeps.aws as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Delete failed');
      });

      const cleaner = new OrphanCleaner({ tfDir: '/path/to/tf', region: 'ap-northeast-1' }, mockDeps);
      const result = cleaner.deleteLogGroup('/k8s-ml-platform/prod/vpc-flow-logs');

      expect(result).toBe(false);
      expect(mockDeps.log.warn).toHaveBeenCalled();
    });
  });

  describe('cleanupLogGroups', () => {
    it('should skip log groups managed by terraform', async () => {
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue('aws_cloudwatch_log_group.vpc_flow_logs');

      const cleaner = new OrphanCleaner({ tfDir: '/path/to/tf', region: 'ap-northeast-1' }, mockDeps);
      await cleaner.cleanupLogGroups(['/k8s-ml-platform/prod/vpc-flow-logs']);

      expect(mockDeps.log.pass).toHaveBeenCalledWith(
        'Log group /k8s-ml-platform/prod/vpc-flow-logs is managed by Terraform'
      );
    });

    it('should delete orphan log groups', async () => {
      // First call for state list (not managed)
      // Second call for aws check (exists)
      (mockDeps.run as ReturnType<typeof vi.fn>).mockReturnValue('aws_vpc.main');
      (mockDeps.aws as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
        if (cmd.includes('describe-log-groups')) return '/k8s-ml-platform/prod/vpc-flow-logs';
        return '';
      });

      const cleaner = new OrphanCleaner({ tfDir: '/path/to/tf', region: 'ap-northeast-1' }, mockDeps);
      await cleaner.cleanupLogGroups(['/k8s-ml-platform/prod/vpc-flow-logs']);

      expect(mockDeps.log.warn).toHaveBeenCalledWith(
        'Orphan log group found: /k8s-ml-platform/prod/vpc-flow-logs'
      );
    });
  });
});
