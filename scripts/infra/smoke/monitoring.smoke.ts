/**
 * Monitoring Smoke Tests
 *
 * Verifies monitoring stack health (Prometheus, Grafana, Loki, Alertmanager).
 * These tests run via SSM on the bastion host.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { createSmoke, ok, fail, warn } from './helpers.js';
import { lib } from '../framework/command/InfraCommand.js';
import type { TerraformOutputs } from '../infrastructure/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONITORING_NAMESPACE = 'monitoring';

// ============================================================
// Helper Functions
// ============================================================

interface MonitoringContext {
  ssm: InstanceType<typeof lib.SSMCommandRunner>;
  kubeconfigSetup: string;
}

let cachedContext: MonitoringContext | null = null;

/**
 * Initialize SSM and kubeconfig context (cached for performance)
 */
async function getMonitoringContext(): Promise<MonitoringContext | null> {
  if (cachedContext) return cachedContext;

  try {
    const tfDir = path.resolve(__dirname, '../../../infra/terraform/prod');
    const tf: TerraformOutputs = lib.createTerraformOutputs(tfDir);
    const instanceId = tf.bastionId();

    if (!instanceId) {
      return null;
    }

    const validInstanceId = lib.validateInstanceId(instanceId);
    const region = lib.awsGetRegion();
    const clusterName = tf.get('cluster_name') || 'prod-eks-cluster';
    const kubeconfigPath = '/tmp/.kube/config';

    const kubeconfigSetup = [
      'export PATH=/usr/local/bin:$PATH',
      `export KUBECONFIG=${kubeconfigPath}`,
      'mkdir -p /tmp/.kube',
      `aws eks update-kubeconfig --region ${region} --name ${clusterName} --kubeconfig ${kubeconfigPath} >/dev/null 2>&1`,
    ].join(' && ');

    cachedContext = {
      ssm: new lib.SSMCommandRunner(validInstanceId, region),
      kubeconfigSetup,
    };

    return cachedContext;
  } catch {
    return null;
  }
}

/**
 * Execute a health check command via kubectl exec
 */
async function checkHealth(
  deploymentType: 'deploy' | 'sts',
  deploymentName: string,
  port: number,
  healthPath: string
): Promise<{ success: boolean; output: string; error?: string }> {
  const ctx = await getMonitoringContext();
  if (!ctx) {
    return { success: false, output: '', error: 'Failed to initialize monitoring context' };
  }

  const cmd = `${ctx.kubeconfigSetup} && kubectl exec -n ${MONITORING_NAMESPACE} ${deploymentType}/${deploymentName} -- wget -qO- http://localhost:${port}${healthPath}`;
  const result = await ctx.ssm.execute(cmd, { timeout: 30, label: deploymentName, stream: false });

  return {
    success: result.success,
    output: result.output || '',
    error: result.error,
  };
}

// ============================================================
// Individual Smoke Tests
// ============================================================

export const prometheusSmoke = createSmoke('prometheus', async () => {
  const result = await checkHealth('deploy', 'prometheus', 9090, '/-/ready');

  if (!result.success) {
    if (result.error?.includes('not found') || result.error?.includes('No such')) {
      return warn('Prometheus not deployed', { error: result.error });
    }
    return fail('Prometheus health check failed', { error: result.error });
  }

  return ok('Prometheus ready');
});

export const grafanaSmoke = createSmoke('grafana', async () => {
  const result = await checkHealth('deploy', 'grafana', 3000, '/api/health');

  if (!result.success) {
    if (result.error?.includes('not found') || result.error?.includes('No such')) {
      return warn('Grafana not deployed', { error: result.error });
    }
    return fail('Grafana health check failed', { error: result.error });
  }

  // Check response for ok status
  if (result.output.includes('"database": "ok"') || result.output.includes('ok')) {
    return ok('Grafana healthy', { response: result.output.substring(0, 100) });
  }

  return warn('Grafana responded but health status unclear', { response: result.output.substring(0, 100) });
});

export const lokiSmoke = createSmoke('loki', async () => {
  const result = await checkHealth('sts', 'loki', 3100, '/ready');

  if (!result.success) {
    if (result.error?.includes('not found') || result.error?.includes('No such')) {
      return warn('Loki not deployed', { error: result.error });
    }
    return fail('Loki health check failed', { error: result.error });
  }

  // Loki returns "ready" when healthy
  if (result.output.toLowerCase().includes('ready')) {
    return ok('Loki ready');
  }

  return warn('Loki responded but status unclear', { response: result.output.substring(0, 100) });
});

export const alertmanagerSmoke = createSmoke('alertmanager', async () => {
  const result = await checkHealth('deploy', 'alertmanager', 9093, '/-/healthy');

  if (!result.success) {
    if (result.error?.includes('not found') || result.error?.includes('No such')) {
      return warn('Alertmanager not deployed', { error: result.error });
    }
    return fail('Alertmanager health check failed', { error: result.error });
  }

  return ok('Alertmanager healthy');
});

// ============================================================
// Combined Monitoring Smoke Test
// ============================================================

export const monitoringSmoke = createSmoke('monitoring', async () => {
  const ctx = await getMonitoringContext();
  if (!ctx) {
    return fail('Bastion/SSM not available for monitoring checks');
  }

  const results = {
    prometheus: await checkHealth('deploy', 'prometheus', 9090, '/-/ready'),
    grafana: await checkHealth('deploy', 'grafana', 3000, '/api/health'),
    loki: await checkHealth('sts', 'loki', 3100, '/ready'),
    alertmanager: await checkHealth('deploy', 'alertmanager', 9093, '/-/healthy'),
  };

  const healthy = Object.entries(results).filter(([_, r]) => r.success);
  const unhealthy = Object.entries(results).filter(([_, r]) => !r.success);

  if (unhealthy.length === 0) {
    return ok(`All 4 monitoring components healthy`, {
      components: Object.keys(results),
    });
  }

  if (healthy.length === 0) {
    return fail('All monitoring components failed', {
      failed: unhealthy.map(([name, r]) => ({ name, error: r.error })),
    });
  }

  return warn(`${healthy.length}/4 monitoring components healthy`, {
    healthy: healthy.map(([name]) => name),
    failed: unhealthy.map(([name, r]) => ({ name, error: r.error })),
  });
});
