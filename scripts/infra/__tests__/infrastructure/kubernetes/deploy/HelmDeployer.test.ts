/**
 * Tests for HelmDeployer class
 */
import { describe, it, expect } from 'vitest';
import { HelmDeployer } from '../../../../infrastructure/kubernetes/deploy/HelmDeployer.js';
import {
  createMockDeployerDependencies,
  createMockDeployerConfig,
} from '../../../utils/test-helpers.js';

describe('HelmDeployer', () => {
  it('addRepo executes helm repo add', async () => {
    const deps = createMockDeployerDependencies();
    const config = createMockDeployerConfig({ namespace: 'kube-system' });
    const helm = new HelmDeployer(config, deps);

    const result = await helm.addRepo('eks', 'https://aws.github.io/eks-charts');

    expect(result.success).toBe(true);
    expect(deps.run).toHaveBeenCalledWith(
      expect.stringContaining('helm repo add eks'),
      expect.any(Object)
    );
  });

  it('install executes helm install', async () => {
    const deps = createMockDeployerDependencies();
    const config = createMockDeployerConfig({ namespace: 'kube-system' });
    const helm = new HelmDeployer(config, deps);

    const result = await helm.install({
      releaseName: 'my-release',
      chart: 'my-chart',
    });

    expect(result.success).toBe(true);
    expect(deps.run).toHaveBeenCalledWith(
      expect.stringContaining('helm install my-release my-chart'),
      expect.any(Object)
    );
  });

  it('upgrade executes helm upgrade', async () => {
    const deps = createMockDeployerDependencies();
    const config = createMockDeployerConfig({ namespace: 'kube-system' });
    const helm = new HelmDeployer(config, deps);

    const result = await helm.upgrade({
      releaseName: 'my-release',
      chart: 'my-chart',
      install: true,
    });

    expect(result.success).toBe(true);
    expect(deps.run).toHaveBeenCalledWith(
      expect.stringContaining('helm upgrade --install my-release my-chart'),
      expect.any(Object)
    );
  });

  it('list returns releases', async () => {
    const deps = createMockDeployerDependencies();
    deps.run.mockReturnValue('NAME\tNAMESPACE\tREVISION\nmy-release\tkube-system\t1');
    const config = createMockDeployerConfig({ namespace: 'kube-system' });
    const helm = new HelmDeployer(config, deps);

    const result = await helm.list();

    expect(result.success).toBe(true);
    expect(result.output).toContain('my-release');
  });

  it('uninstall executes helm uninstall', async () => {
    const deps = createMockDeployerDependencies();
    const config = createMockDeployerConfig({ namespace: 'kube-system' });
    const helm = new HelmDeployer(config, deps);

    const result = await helm.uninstall('my-release');

    expect(result.success).toBe(true);
    expect(deps.run).toHaveBeenCalledWith(
      expect.stringContaining('helm uninstall my-release'),
      expect.any(Object)
    );
  });
});
