/**
 * Tests for ManifestDeployer class
 */
import { describe, it, expect } from 'vitest';
import { ManifestDeployer } from '../../../../infrastructure/kubernetes/deploy/ManifestDeployer.js';
import {
  createMockDeployerDependencies,
  createMockDeployerConfig,
} from '../../../utils/test-helpers.js';

describe('ManifestDeployer', () => {
  it('applyManifest executes kubectl apply', async () => {
    const deps = createMockDeployerDependencies();
    const config = createMockDeployerConfig({ namespace: 'app' });
    const deployer = new ManifestDeployer(config, deps);

    const result = await deployer.applyManifest('apiVersion: v1\nkind: ConfigMap');

    expect(result.success).toBe(true);
    expect(deps.run).toHaveBeenCalledWith(
      expect.stringContaining('kubectl apply'),
      expect.any(Object)
    );
  });

  it('deleteManifest executes kubectl delete', async () => {
    const deps = createMockDeployerDependencies();
    const config = createMockDeployerConfig({ namespace: 'app' });
    const deployer = new ManifestDeployer(config, deps);

    const result = await deployer.deleteManifest('apiVersion: v1\nkind: ConfigMap');

    expect(result.success).toBe(true);
    expect(deps.run).toHaveBeenCalledWith(
      expect.stringContaining('kubectl delete'),
      expect.any(Object)
    );
  });

  it('ensureNamespace creates namespace', async () => {
    const deps = createMockDeployerDependencies();
    const config = createMockDeployerConfig({ namespace: 'app' });
    const deployer = new ManifestDeployer(config, deps);

    const result = await deployer.ensureNamespace('my-namespace');

    expect(result.success).toBe(true);
    expect(deps.run).toHaveBeenCalledWith(
      expect.stringContaining('kubectl create namespace my-namespace'),
      expect.any(Object)
    );
  });

  it('getPods returns pod list', async () => {
    const deps = createMockDeployerDependencies();
    deps.run.mockReturnValue('NAME  READY  STATUS\npod-1  1/1  Running');
    const config = createMockDeployerConfig({ namespace: 'app' });
    const deployer = new ManifestDeployer(config, deps);

    const result = await deployer.getPods();

    expect(result.success).toBe(true);
    expect(result.output).toContain('pod-1');
  });

  it('rolloutRestart executes kubectl rollout restart', async () => {
    const deps = createMockDeployerDependencies();
    const config = createMockDeployerConfig({ namespace: 'app' });
    const deployer = new ManifestDeployer(config, deps);

    const result = await deployer.rolloutRestart('deployment', 'my-app');

    expect(result.success).toBe(true);
    expect(deps.run).toHaveBeenCalledWith(
      expect.stringContaining('kubectl rollout restart deployment/my-app'),
      expect.any(Object)
    );
  });
});
