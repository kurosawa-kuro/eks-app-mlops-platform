#!/usr/bin/env npx tsx
/**
 * EKS Debug Script
 * Debug and inspect EKS cluster: nodes, pods, gpu, events
 *
 * Private EKS 対応: Bastion 経由で kubectl を実行
 */

import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import { createConfig } from '../../config/index.js';
import type { CommandDefinition, OptionDefinition } from '../../framework/types.js';

const { SSMCommandRunner } = lib;

// Configuration
const sharedConfig = createConfig();
const CONFIG = {
  region: sharedConfig.region,
  clusterName: sharedConfig.clusterName || 'prod-eks-cluster',
};

class EksDebug extends InfraCommand {
  static override name = 'eks-debug';
  static override description = 'EKS Debug and Inspection Tool';

  static override commands: Record<string, CommandDefinition> = {
    nodes: { desc: 'Show node status and resources', aliases: ['node', 'n'] },
    pod: { desc: 'Show pod details (logs, events, describe)', args: '<name>', aliases: ['p'] },
    pods: { desc: 'List all pods with status', aliases: ['ps'] },
    gpu: { desc: 'Show GPU nodes and pods', aliases: ['g'] },
    events: { desc: 'Show cluster events (sorted by time)', aliases: ['ev', 'e'] },
    logs: { desc: 'Show pod logs', args: '<name>', aliases: ['log', 'l'] },
    top: { desc: 'Show resource usage (nodes/pods)', args: '[nodes|pods]', aliases: ['t'] },
    describe: { desc: 'Describe deployment (backend/frontend)', args: '[backend|frontend]', aliases: ['desc', 'd'] },
    secrets: { desc: 'Show app-backend-secrets', aliases: ['secret', 'sec'] },
    restart: { desc: 'Restart app deployments (backend/frontend/all)', args: '[backend|frontend|all]', aliases: ['rs'] },
    health: { desc: 'Health check via curl pod', aliases: ['h'] },
  };

  static override options: Record<string, OptionDefinition> = {
    '-n': { name: 'namespace', type: 'string', desc: 'Kubernetes namespace' },
    '--namespace': { name: 'namespace', type: 'string', desc: 'Kubernetes namespace' },
    '-A': { name: 'allNamespaces', type: 'boolean', desc: 'All namespaces' },
    '--all-namespaces': { name: 'allNamespaces', type: 'boolean', desc: 'All namespaces' },
    '--previous': { name: 'previous', type: 'boolean', desc: 'Show previous container logs' },
    '-f': { name: 'follow', type: 'boolean', desc: 'Follow log output' },
    '--tail': { name: 'tail', type: 'string', desc: 'Lines of recent log (default: 100)' },
    '--since': { name: 'since', type: 'string', desc: 'Show events since duration (e.g. 1h, 30m)' },
  };

  private bastionId: string | null = null;
  private ssmRunner: InstanceType<typeof SSMCommandRunner> | null = null;

  // ============================================================
  // Helpers
  // ============================================================

  private async initBastion(): Promise<boolean> {
    // Always use Bastion for private EKS cluster
    // Get bastion instance ID from Terraform outputs
    const tf = lib.createTerraformOutputs(sharedConfig.tfDir);
    this.bastionId = tf.bastionId();
    if (!this.bastionId) {
      lib.log.fail('Bastion instance ID not found. Check Terraform outputs.');
      return false;
    }

    // Check bastion is online via EC2 API
    const ec2Result = lib.aws(
      `ec2 describe-instances --instance-ids ${this.bastionId} --query 'Reservations[0].Instances[0].State.Name' --output text`,
      { ignoreError: true, region: CONFIG.region }
    );
    const status = (ec2Result || '').trim();
    if (status !== 'running') {
      lib.log.fail(`Bastion is not running (status: ${status}). Start with: make bastion-start`);
      return false;
    }

    // Check SSM connectivity
    const ssmResult = lib.aws(
      `ssm describe-instance-information --filters "Key=InstanceIds,Values=${this.bastionId}" --query 'InstanceInformationList[0].PingStatus' --output text`,
      { ignoreError: true, region: CONFIG.region }
    );
    const ssmStatus = (ssmResult || '').trim();
    if (ssmStatus !== 'Online') {
      lib.log.fail(`Bastion SSM is not online (status: ${ssmStatus}). Please wait or check SSM agent.`);
      return false;
    }

    this.ssmRunner = new SSMCommandRunner(this.bastionId, CONFIG.region);

    lib.log.info(`Using Bastion: ${this.bastionId}`);
    return true;
  }

  private async kubectl(args: string, opts: { ignoreError?: boolean } = {}): Promise<string> {
    const cmd = `kubectl ${args}`;

    if (!this.ssmRunner) {
      throw new Error('SSM runner not initialized. Call initBastion() first.');
    }

    // Run via SSM on bastion
    // Use explicit KUBECONFIG path and suppress kubeconfig update noise
    const kubeconfigPath = '/tmp/.kube/config';
    const commands = [
      'export KUBECONFIG=' + kubeconfigPath,
      'mkdir -p /tmp/.kube',
      `aws eks update-kubeconfig --region ${CONFIG.region} --name ${CONFIG.clusterName} --kubeconfig ${kubeconfigPath} >/dev/null 2>&1`,
      cmd,
    ].join('\n');

    const result = await this.ssmRunner.execute(commands, {
      label: `kubectl ${args.split(' ')[0]}`,
      timeout: 60,
      stream: false,
    });

    if (!result.success && !opts.ignoreError) {
      throw new Error(result.error || 'SSM command failed');
    }

    return result.output || '';
  }

  private getNamespaceFlag(): string {
    if (this.options.allNamespaces) return '-A';
    if (this.options.namespace) return `-n ${this.options.namespace}`;
    return '';
  }

  private async checkKubectl(): Promise<boolean> {
    // Initialize bastion connection (always required for private EKS)
    return await this.initBastion();
  }

  // ============================================================
  // Commands
  // ============================================================

  async cmdNodes(): Promise<number> {
    if (!(await this.checkKubectl())) return 1;

    lib.log.header('Kubernetes Nodes');

    // Node list with status
    lib.log.section('Node Status');
    console.log(await this.kubectl('get nodes -o wide'));

    // Node resources
    lib.log.section('Node Resources');
    console.log(await this.kubectl('describe nodes | grep -A 5 "Allocated resources"', { ignoreError: true }));

    // Node conditions (simplified for SSM)
    lib.log.section('Node Conditions');
    const nodeConditions = await this.kubectl(
      'get nodes -o custom-columns="NAME:.metadata.name,READY:.status.conditions[?(@.type==\\"Ready\\")].status,DISK:.status.conditions[?(@.type==\\"DiskPressure\\")].status,MEM:.status.conditions[?(@.type==\\"MemoryPressure\\")].status"',
      { ignoreError: true }
    );
    console.log(nodeConditions);

    return 0;
  }

  async cmdPod(name?: string): Promise<number> {
    if (!(await this.checkKubectl())) return 1;
    if (!name) {
      lib.log.fail('Pod name required. Usage: npx tsx eks-debug.ts pod <name>');
      return 1;
    }

    const ns = this.getNamespaceFlag() || '-A';

    lib.log.header(`Pod: ${name}`);

    // Find pod (partial match support)
    lib.log.section('Pod Info');
    const podList = await this.kubectl(`get pods ${ns} -o name 2>/dev/null | grep ${name}`, { ignoreError: true });
    if (!podList) {
      lib.log.fail(`Pod "${name}" not found`);
      return 1;
    }

    const podName = podList.split('\n')[0].replace('pod/', '');
    const podNs = ns === '-A' ? '' : ns;
    console.log(await this.kubectl(`get pod ${podName} ${podNs} -o wide`));

    // Describe
    lib.log.section('Describe');
    console.log(await this.kubectl(`describe pod ${podName} ${podNs}`));

    // Events
    lib.log.section('Events');
    console.log(await this.kubectl(`get events ${podNs} --field-selector involvedObject.name=${podName} --sort-by='.lastTimestamp'`, { ignoreError: true }));

    // Recent logs
    lib.log.section('Recent Logs (last 50 lines)');
    console.log(await this.kubectl(`logs ${podName} ${podNs} --tail=50`, { ignoreError: true }));

    return 0;
  }

  async cmdPods(): Promise<number> {
    if (!(await this.checkKubectl())) return 1;

    const ns = this.getNamespaceFlag() || '-A';

    lib.log.header('All Pods');
    console.log(await this.kubectl(`get pods ${ns} -o wide --sort-by='.metadata.namespace'`));

    // Show non-running pods
    lib.log.section('Non-Running Pods');
    const nonRunning = await this.kubectl(`get pods ${ns} --field-selector=status.phase!=Running,status.phase!=Succeeded -o wide 2>/dev/null`, { ignoreError: true });
    if (nonRunning && !nonRunning.includes('No resources found')) {
      console.log(nonRunning);
    } else {
      console.log('All pods are Running or Succeeded');
    }

    return 0;
  }

  async cmdGpu(): Promise<number> {
    if (!(await this.checkKubectl())) return 1;

    lib.log.header('GPU Resources');

    // GPU nodes
    lib.log.section('GPU Nodes');
    const gpuNodes = await this.kubectl('get nodes -l nvidia.com/gpu.present=true -o wide 2>/dev/null', { ignoreError: true });
    if (gpuNodes && !gpuNodes.includes('No resources found')) {
      console.log(gpuNodes);
    } else {
      console.log('No GPU nodes found');
    }

    // Node GPU capacity
    lib.log.section('GPU Capacity');
    console.log(await this.kubectl('get nodes -o custom-columns="NAME:.metadata.name,GPU:.status.capacity.nvidia\\.com/gpu" 2>/dev/null', { ignoreError: true }));

    // GPU pods
    lib.log.section('GPU Pods');
    const gpuPods = await this.kubectl('get pods -A -o json 2>/dev/null | jq -r \'.items[] | select(.spec.containers[].resources.limits."nvidia.com/gpu" != null) | "\\(.metadata.namespace)/\\(.metadata.name)"\'', { ignoreError: true });
    if (gpuPods) {
      console.log(gpuPods);
    } else {
      console.log('No GPU pods found');
    }

    // NVIDIA device plugin
    lib.log.section('NVIDIA Device Plugin');
    console.log(await this.kubectl('get pods -n kube-system -l name=nvidia-device-plugin-ds -o wide 2>/dev/null', { ignoreError: true }) || 'Not installed');

    return 0;
  }

  async cmdEvents(): Promise<number> {
    if (!(await this.checkKubectl())) return 1;

    const ns = this.getNamespaceFlag() || '-A';

    lib.log.header('Cluster Events');

    // Warning events first
    lib.log.section('Warning Events');
    const warnings = await this.kubectl(`get events ${ns} --field-selector type=Warning --sort-by='.lastTimestamp' 2>/dev/null | tail -30`, { ignoreError: true });
    if (warnings && !warnings.includes('No resources found')) {
      console.log(warnings);
    } else {
      console.log('No warning events');
    }

    // Recent events
    lib.log.section('Recent Events (all types)');
    console.log(await this.kubectl(`get events ${ns} --sort-by='.lastTimestamp' 2>/dev/null | tail -50`, { ignoreError: true }));

    return 0;
  }

  async cmdLogs(name?: string): Promise<number> {
    if (!(await this.checkKubectl())) return 1;
    if (!name) {
      lib.log.fail('Pod name required. Usage: npx tsx eks-debug.ts logs <name>');
      return 1;
    }

    const ns = this.getNamespaceFlag() || '-A';
    const tail = (this.options.tail as string) || '100';
    const previous = this.options.previous ? '--previous' : '';

    // Find pod
    const podList = await this.kubectl(`get pods ${ns} -o name 2>/dev/null | grep ${name}`, { ignoreError: true });
    if (!podList) {
      lib.log.fail(`Pod "${name}" not found`);
      return 1;
    }

    const podName = podList.split('\n')[0].replace('pod/', '');
    const podNs = ns === '-A' ? '' : ns;
    lib.log.header(`Logs: ${podName}`);

    // Note: -f (follow) is not supported via SSM
    if (this.options.follow) {
      lib.log.warn('Follow mode (-f) is not supported via Bastion. Showing recent logs instead.');
    }

    console.log(await this.kubectl(`logs ${podName} ${podNs} --tail=${tail} ${previous}`, { ignoreError: true }));

    return 0;
  }

  async cmdTop(resource?: string): Promise<number> {
    if (!(await this.checkKubectl())) return 1;

    const target = resource || 'nodes';
    const ns = this.getNamespaceFlag();

    lib.log.header(`Resource Usage: ${target}`);

    if (target === 'nodes' || target === 'node') {
      console.log(await this.kubectl('top nodes 2>/dev/null', { ignoreError: true }) || 'Metrics server not available');
    } else if (target === 'pods' || target === 'pod') {
      const nsFlag = ns || '-A';
      console.log(await this.kubectl(`top pods ${nsFlag} --sort-by=memory 2>/dev/null`, { ignoreError: true }) || 'Metrics server not available');
    } else {
      lib.log.fail(`Unknown resource: ${target}. Use 'nodes' or 'pods'`);
      return 1;
    }

    return 0;
  }

  async cmdDescribe(target?: string): Promise<number> {
    if (!(await this.checkKubectl())) return 1;

    const deployment = target || 'backend';
    const deployName = deployment === 'backend' ? 'app-backend' : deployment === 'frontend' ? 'app-frontend' : deployment;

    lib.log.header(`Describe Deployment: ${deployName}`);

    // Deployment describe
    lib.log.section('Deployment');
    console.log(await this.kubectl(`describe deployment ${deployName} -n app`, { ignoreError: true }));

    // Pod describe
    lib.log.section('Pods');
    console.log(await this.kubectl(`describe pod -n app -l app.kubernetes.io/name=${deployName}`, { ignoreError: true }));

    // Events
    lib.log.section('Events');
    console.log(await this.kubectl(`get events -n app --field-selector involvedObject.name=${deployName} --sort-by='.lastTimestamp'`, { ignoreError: true }));

    return 0;
  }

  async cmdSecrets(): Promise<number> {
    if (!(await this.checkKubectl())) return 1;

    lib.log.header('App Backend Secrets');

    // List secrets
    lib.log.section('Secrets in app namespace');
    console.log(await this.kubectl('get secrets -n app', { ignoreError: true }));

    // Show app-backend-secrets (decoded)
    lib.log.section('app-backend-secrets (decoded)');
    const secretJson = await this.kubectl('get secret app-backend-secrets -n app -o json', { ignoreError: true });
    if (secretJson && !secretJson.includes('NotFound')) {
      try {
        const secret = JSON.parse(secretJson);
        for (const [key, value] of Object.entries(secret.data || {})) {
          const decoded = Buffer.from(value as string, 'base64').toString('utf-8');
          // Mask sensitive values
          const masked = key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')
            ? decoded.substring(0, 4) + '****'
            : decoded;
          console.log(`  ${key}: ${masked}`);
        }
      } catch {
        console.log('Failed to parse secret');
      }
    } else {
      console.log('Secret not found');
    }

    return 0;
  }

  async cmdRestart(target?: string): Promise<number> {
    if (!(await this.checkKubectl())) return 1;

    const restartTarget = target || 'all';

    lib.log.header(`Restart Deployments: ${restartTarget}`);

    const deployments: string[] = [];
    if (restartTarget === 'all') {
      deployments.push('app-backend', 'app-frontend');
    } else if (restartTarget === 'backend') {
      deployments.push('app-backend');
    } else if (restartTarget === 'frontend') {
      deployments.push('app-frontend');
    } else {
      deployments.push(restartTarget);
    }

    for (const deploy of deployments) {
      lib.log.info(`Restarting ${deploy}...`);
      await this.kubectl(`rollout restart deployment/${deploy} -n app`);
      lib.log.info(`Waiting for rollout...`);
      const result = await this.kubectl(`rollout status deployment/${deploy} -n app --timeout=120s`, { ignoreError: true });
      if (result.includes('successfully rolled out')) {
        lib.log.pass(`${deploy} restarted successfully`);
      } else {
        lib.log.warn(`${deploy} rollout status: ${result}`);
      }
    }

    return 0;
  }

  async cmdHealth(): Promise<number> {
    if (!(await this.checkKubectl())) return 1;

    lib.log.header('Health Check');

    // Run curl pod to check backend health endpoint
    const result = await this.kubectl(
      'run curl-test --image=curlimages/curl --rm -it --restart=Never -n app -- curl -s http://app-backend-service:8000/health',
      { ignoreError: true }
    );
    console.log(result);

    // Check if health check passed
    if (result.includes('ok') || result.includes('"status"')) {
      lib.log.pass('Health check passed');
      return 0;
    }

    lib.log.fail('Health check failed');
    return 1;
  }
}

// Only run when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  EksDebug.main();
}
