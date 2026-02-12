#!/usr/bin/env npx tsx
/**
 * Kind Cluster Management Script
 *
 * CRUD operations for local Kind (Kubernetes in Docker) development.
 *
 * Usage:
 *   npx tsx kind-manage.ts create           # Create Kind cluster
 *   npx tsx kind-manage.ts delete           # Delete Kind cluster
 *   npx tsx kind-manage.ts status           # Show cluster status
 *   npx tsx kind-manage.ts build [target]   # Build Docker image(s)
 *   npx tsx kind-manage.ts load [target]    # Load image(s) to Kind
 *   npx tsx kind-manage.ts deploy           # Deploy to Kind
 *   npx tsx kind-manage.ts undeploy         # Remove deployment
 *   npx tsx kind-manage.ts logs [target]    # Show logs
 *   npx tsx kind-manage.ts port-forward     # Port forward services
 *   npx tsx kind-manage.ts --help           # Show help
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import type { CommandDefinition, OptionDefinition } from '../../framework/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// Configuration
// ============================================================

interface KindConfig {
  clusterName: string;
  namespace: string;
  backendImage: string;
  frontendImage: string;
  backendPort: number;
  frontendPort: number;
  localOverlay: string;
  clusterConfigPath: string;
}

const ROOT_DIR = path.resolve(__dirname, '../..');

const DEFAULT_CONFIG: KindConfig = {
  clusterName: process.env.KIND_CLUSTER || 'dev-cluster',
  namespace: process.env.K8S_NAMESPACE || 'app',
  backendImage: 'app-backend',
  frontendImage: 'app-frontend',
  backendPort: parseInt(process.env.KIND_BACKEND_PORT || '8001', 10),
  frontendPort: parseInt(process.env.KIND_FRONTEND_PORT || '3001', 10),
  localOverlay: path.join(ROOT_DIR, 'infra/k8s/apps/overlays/local'),
  clusterConfigPath: path.join(ROOT_DIR, 'infra/k8s/kind/cluster-config.yaml'),
};

const PATHS = {
  backendDir: path.join(ROOT_DIR, 'apps/app-backend'),
  frontendDir: path.join(ROOT_DIR, 'apps/app-frontend'),
};

type BuildTarget = 'backend' | 'frontend' | 'all';
type LogTarget = 'backend' | 'frontend';

// ============================================================
// Kind Manager Class
// ============================================================

class KindManage extends InfraCommand {
  static override name = 'kind-manage';
  static override description = 'Kind Cluster Management Tool';

  static override commands: Record<string, CommandDefinition> = {
    // Cluster Management
    create: { desc: 'Create Kind cluster', aliases: ['c', 'up'] },
    delete: { desc: 'Delete Kind cluster', aliases: ['d', 'down', 'destroy'] },
    status: { desc: 'Show cluster status', aliases: ['s', 'st'] },
    context: { desc: 'Switch to Kind context', aliases: ['ctx'] },

    // Docker Build
    build: { desc: 'Build Docker image(s)', args: '[target]', aliases: ['b'] },

    // Load to Kind
    load: { desc: 'Load image(s) to Kind', args: '[target]', aliases: ['l'] },

    // Kubernetes Deploy
    deploy: { desc: 'Deploy to Kind cluster', aliases: ['dep'] },
    undeploy: { desc: 'Remove deployment', aliases: ['rm', 'remove'] },
    restart: { desc: 'Restart deployment (undeploy + deploy)', aliases: ['r'] },

    // Full Pipeline
    'build-deploy': { desc: 'Build, load, and deploy', aliases: ['bd', 'full'] },

    // Logs
    logs: { desc: 'Show pod logs', args: '[target]', aliases: ['log'] },

    // Port Forward
    'port-forward': { desc: 'Port forward services', args: '[target]', aliases: ['pf'] },

    // Info
    info: { desc: 'Show configuration', aliases: ['i'] },
  };

  static override options: Record<string, OptionDefinition> = {
    '--cluster': { name: 'cluster', type: 'string', desc: 'Kind cluster name' },
    '--namespace': { name: 'namespace', type: 'string', desc: 'Kubernetes namespace' },
    '--follow': { name: 'follow', type: 'boolean', desc: 'Follow logs' },
    '--tail': { name: 'tail', type: 'string', desc: 'Lines of logs to show (default: 100)' },
  };

  private config!: KindConfig;

  // ============================================================
  // Initialization
  // ============================================================

  private initConfig(): void {
    this.config = {
      ...DEFAULT_CONFIG,
      clusterName: (this.options.cluster as string) || DEFAULT_CONFIG.clusterName,
      namespace: (this.options.namespace as string) || DEFAULT_CONFIG.namespace,
    };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private kindExists(): boolean {
    try {
      lib.run('which kind', { silent: true });
      return true;
    } catch {
      return false;
    }
  }

  private dockerExists(): boolean {
    try {
      lib.run('which docker', { silent: true });
      return true;
    } catch {
      return false;
    }
  }

  private kubectlExists(): boolean {
    try {
      lib.run('which kubectl', { silent: true });
      return true;
    } catch {
      return false;
    }
  }

  private clusterExists(): boolean {
    try {
      const clusters = lib.run('kind get clusters', { silent: true });
      return clusters.split('\n').includes(this.config.clusterName);
    } catch {
      return false;
    }
  }

  private getClusterContext(): string {
    return `kind-${this.config.clusterName}`;
  }

  private switchContext(): boolean {
    try {
      lib.run(`kubectl config use-context ${this.getClusterContext()}`, { silent: true });
      return true;
    } catch {
      return false;
    }
  }

  private parseTarget(target?: string): BuildTarget {
    if (!target || target === 'all') return 'all';
    if (target === 'backend' || target === 'be' || target === 'b') return 'backend';
    if (target === 'frontend' || target === 'fe' || target === 'f') return 'frontend';
    return 'all';
  }

  private parseLogTarget(target?: string): LogTarget {
    if (target === 'frontend' || target === 'fe' || target === 'f') return 'frontend';
    return 'backend';
  }

  // ============================================================
  // Cluster Management Commands
  // ============================================================

  async cmdCreate(): Promise<number> {
    this.initConfig();

    lib.log.header('Create Kind Cluster');
    lib.log.info(`Cluster: ${this.config.clusterName}`);
    console.log('');

    // Preflight checks
    if (!this.kindExists()) {
      lib.log.fail('kind not found. Install: https://kind.sigs.k8s.io/docs/user/quick-start/#installation');
      return 1;
    }

    if (!this.dockerExists()) {
      lib.log.fail('docker not found. Install: https://docs.docker.com/get-docker/');
      return 1;
    }

    // Check if cluster already exists
    if (this.clusterExists()) {
      lib.log.warn(`Cluster '${this.config.clusterName}' already exists`);
      lib.log.info('Use "kind-manage delete" to remove it first, or use a different name');
      return 0;
    }

    // Create cluster
    lib.log.section('Creating Cluster');

    const createArgs = ['create', 'cluster', '--name', this.config.clusterName];

    // Use config file if exists
    if (fs.existsSync(this.config.clusterConfigPath)) {
      lib.log.info(`Using config: ${this.config.clusterConfigPath}`);
      createArgs.push('--config', this.config.clusterConfigPath);
    }

    const result = spawnSync('kind', createArgs, { stdio: 'inherit' });

    if (result.status !== 0) {
      lib.log.fail('Failed to create Kind cluster');
      return 1;
    }

    // Switch context
    this.switchContext();

    console.log('');
    lib.log.pass(`Kind cluster '${this.config.clusterName}' created`);
    lib.log.info(`Context: ${this.getClusterContext()}`);
    console.log('');
    lib.log.info('Next steps:');
    console.log('  1. Build images:    npx tsx kind-manage.ts build');
    console.log('  2. Load to Kind:    npx tsx kind-manage.ts load');
    console.log('  3. Deploy:          npx tsx kind-manage.ts deploy');

    return 0;
  }

  async cmdDelete(): Promise<number> {
    this.initConfig();

    lib.log.header('Delete Kind Cluster');
    lib.log.info(`Cluster: ${this.config.clusterName}`);
    console.log('');

    if (!this.clusterExists()) {
      lib.log.warn(`Cluster '${this.config.clusterName}' does not exist`);
      return 0;
    }

    // Confirm deletion
    if (!await lib.confirm(`Delete cluster '${this.config.clusterName}'?`)) {
      lib.log.info('Cancelled');
      return 0;
    }

    lib.log.section('Deleting Cluster');

    const result = spawnSync('kind', ['delete', 'cluster', '--name', this.config.clusterName], {
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      lib.log.fail('Failed to delete Kind cluster');
      return 1;
    }

    console.log('');
    lib.log.pass(`Kind cluster '${this.config.clusterName}' deleted`);
    return 0;
  }

  async cmdStatus(): Promise<number> {
    this.initConfig();

    lib.log.header('Kind Cluster Status');

    // Kind clusters
    lib.log.section('Kind Clusters');
    try {
      const clusters = lib.run('kind get clusters', { silent: true, ignoreError: true });
      if (clusters) {
        clusters.split('\n').filter(Boolean).forEach(cluster => {
          const isCurrent = cluster === this.config.clusterName;
          console.log(`  ${isCurrent ? lib.c.green('●') : lib.c.dim('○')} ${cluster}${isCurrent ? ' (current)' : ''}`);
        });
      } else {
        lib.log.info('No Kind clusters running');
      }
    } catch {
      lib.log.info('No Kind clusters running');
    }

    if (!this.clusterExists()) {
      console.log('');
      lib.log.info(`Cluster '${this.config.clusterName}' not found. Run 'kind-manage create' to create it.`);
      return 0;
    }

    // Switch to context
    this.switchContext();

    // Nodes
    lib.log.section('Nodes');
    try {
      const nodes = lib.run('kubectl get nodes -o wide', { silent: true });
      console.log(nodes);
    } catch {
      lib.log.warn('Could not get nodes');
    }

    // Pods in namespace
    lib.log.section(`Pods (${this.config.namespace})`);
    try {
      const pods = lib.run(`kubectl get pods -n ${this.config.namespace} -o wide`, { silent: true });
      console.log(pods);
    } catch {
      lib.log.info('No pods found or namespace does not exist');
    }

    // Services
    lib.log.section(`Services (${this.config.namespace})`);
    try {
      const svcs = lib.run(`kubectl get svc -n ${this.config.namespace}`, { silent: true });
      console.log(svcs);
    } catch {
      lib.log.info('No services found');
    }

    // Docker images
    lib.log.section('Local Docker Images');
    try {
      const images = lib.run(`docker images --filter "reference=${this.config.backendImage}" --filter "reference=${this.config.frontendImage}" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"`, { silent: true });
      console.log(images || '  No images found');
    } catch {
      lib.log.info('Could not list Docker images');
    }

    return 0;
  }

  async cmdContext(): Promise<number> {
    this.initConfig();

    lib.log.header('Switch Context');

    if (!this.clusterExists()) {
      lib.log.fail(`Cluster '${this.config.clusterName}' does not exist`);
      return 1;
    }

    if (this.switchContext()) {
      lib.log.pass(`Switched to context: ${this.getClusterContext()}`);
      return 0;
    } else {
      lib.log.fail(`Failed to switch context`);
      return 1;
    }
  }

  // ============================================================
  // Docker Build Commands
  // ============================================================

  async cmdBuild(targetArg?: string): Promise<number> {
    this.initConfig();
    const target = this.parseTarget(targetArg || this.args[0]);

    lib.log.header('Build Docker Images');
    lib.log.info(`Target: ${target}`);
    console.log('');

    if (!this.dockerExists()) {
      lib.log.fail('docker not found');
      return 1;
    }

    const buildImage = (name: string, dir: string, image: string): boolean => {
      lib.log.section(`Building ${name}`);
      lib.log.info(`Image: ${image}:latest`);
      lib.log.info(`Context: ${dir}`);
      console.log('');

      const dockerfile = path.join(dir, 'Dockerfile');
      if (!fs.existsSync(dockerfile)) {
        lib.log.fail(`Dockerfile not found: ${dockerfile}`);
        return false;
      }

      const result = spawnSync('docker', ['build', '-t', `${image}:latest`, '-f', dockerfile, dir], {
        stdio: 'inherit',
      });

      if (result.status !== 0) {
        lib.log.fail(`Failed to build ${name}`);
        return false;
      }

      lib.log.pass(`Built ${image}:latest`);
      return true;
    };

    let success = true;

    if (target === 'backend' || target === 'all') {
      if (!buildImage('Backend', PATHS.backendDir, this.config.backendImage)) {
        success = false;
      }
    }

    if (target === 'frontend' || target === 'all') {
      if (!buildImage('Frontend', PATHS.frontendDir, this.config.frontendImage)) {
        success = false;
      }
    }

    console.log('');
    if (success) {
      lib.log.pass('All images built successfully');
      lib.log.info('Next: npx tsx kind-manage.ts load');
    } else {
      lib.log.fail('Some builds failed');
    }

    return success ? 0 : 1;
  }

  // ============================================================
  // Load to Kind Commands
  // ============================================================

  async cmdLoad(targetArg?: string): Promise<number> {
    this.initConfig();
    const target = this.parseTarget(targetArg || this.args[0]);

    lib.log.header('Load Images to Kind');
    lib.log.info(`Cluster: ${this.config.clusterName}`);
    lib.log.info(`Target: ${target}`);
    console.log('');

    if (!this.clusterExists()) {
      lib.log.fail(`Cluster '${this.config.clusterName}' does not exist`);
      lib.log.info('Run "kind-manage create" first');
      return 1;
    }

    const loadImage = (name: string, image: string): boolean => {
      lib.log.section(`Loading ${name}`);
      lib.log.info(`Image: ${image}:latest`);

      const result = spawnSync('kind', ['load', 'docker-image', `${image}:latest`, '--name', this.config.clusterName], {
        stdio: 'inherit',
      });

      if (result.status !== 0) {
        lib.log.fail(`Failed to load ${name}`);
        return false;
      }

      lib.log.pass(`Loaded ${image}:latest`);
      return true;
    };

    let success = true;

    if (target === 'backend' || target === 'all') {
      if (!loadImage('Backend', this.config.backendImage)) {
        success = false;
      }
    }

    if (target === 'frontend' || target === 'all') {
      if (!loadImage('Frontend', this.config.frontendImage)) {
        success = false;
      }
    }

    console.log('');
    if (success) {
      lib.log.pass('All images loaded successfully');
      lib.log.info('Next: npx tsx kind-manage.ts deploy');
    } else {
      lib.log.fail('Some loads failed');
    }

    return success ? 0 : 1;
  }

  // ============================================================
  // Kubernetes Deploy Commands
  // ============================================================

  async cmdDeploy(): Promise<number> {
    this.initConfig();

    lib.log.header('Deploy to Kind');
    lib.log.info(`Cluster: ${this.config.clusterName}`);
    lib.log.info(`Overlay: ${this.config.localOverlay}`);
    console.log('');

    if (!this.clusterExists()) {
      lib.log.fail(`Cluster '${this.config.clusterName}' does not exist`);
      return 1;
    }

    if (!this.kubectlExists()) {
      lib.log.fail('kubectl not found');
      return 1;
    }

    this.switchContext();

    lib.log.section('Applying Kustomize Overlay');

    if (!fs.existsSync(this.config.localOverlay)) {
      lib.log.fail(`Overlay not found: ${this.config.localOverlay}`);
      return 1;
    }

    const result = spawnSync('kubectl', ['apply', '-k', this.config.localOverlay], {
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      lib.log.fail('Failed to deploy');
      return 1;
    }

    console.log('');
    lib.log.pass('Deployment applied');

    // Wait for rollout
    lib.log.section('Waiting for Rollout');
    try {
      lib.log.info('Waiting for backend...');
      spawnSync('kubectl', ['rollout', 'status', 'deployment/app-backend', '-n', this.config.namespace, '--timeout=120s'], {
        stdio: 'inherit',
      });
    } catch {
      lib.log.warn('Backend rollout status check failed');
    }

    console.log('');
    lib.log.pass('Deployment complete');
    lib.log.info('Check status: npx tsx kind-manage.ts status');
    lib.log.info('View logs:    npx tsx kind-manage.ts logs');

    return 0;
  }

  async cmdUndeploy(): Promise<number> {
    this.initConfig();

    lib.log.header('Remove Deployment');
    lib.log.info(`Cluster: ${this.config.clusterName}`);
    console.log('');

    if (!this.clusterExists()) {
      lib.log.warn(`Cluster '${this.config.clusterName}' does not exist`);
      return 0;
    }

    this.switchContext();

    lib.log.section('Deleting Resources');

    const result = spawnSync('kubectl', ['delete', '-k', this.config.localOverlay, '--ignore-not-found'], {
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      lib.log.fail('Failed to undeploy');
      return 1;
    }

    console.log('');
    lib.log.pass('Deployment removed');
    return 0;
  }

  async cmdRestart(): Promise<number> {
    lib.log.header('Restart Deployment');

    const undeployResult = await this.cmdUndeploy();
    if (undeployResult !== 0) return undeployResult;

    console.log('');
    return await this.cmdDeploy();
  }

  // ============================================================
  // Full Pipeline Command
  // ============================================================

  async cmdBuildDeploy(): Promise<number> {
    this.initConfig();

    lib.log.header('Build, Load, and Deploy');
    console.log('');

    // Build
    lib.log.phase(1, 'Build Docker Images');
    let result = await this.cmdBuild('all');
    if (result !== 0) return result;

    console.log('');

    // Load
    lib.log.phase(2, 'Load Images to Kind');
    result = await this.cmdLoad('all');
    if (result !== 0) return result;

    console.log('');

    // Deploy
    lib.log.phase(3, 'Deploy to Kind');
    result = await this.cmdDeploy();
    if (result !== 0) return result;

    console.log('');
    lib.log.pass('Full pipeline complete!');
    return 0;
  }

  // ============================================================
  // Logs Commands
  // ============================================================

  async cmdLogs(targetArg?: string): Promise<number> {
    this.initConfig();
    const target = this.parseLogTarget(targetArg || this.args[0]);
    const follow = this.options.follow as boolean;
    const tail = (this.options.tail as string) || '100';

    lib.log.header(`Logs: ${target}`);

    if (!this.clusterExists()) {
      lib.log.fail(`Cluster '${this.config.clusterName}' does not exist`);
      return 1;
    }

    this.switchContext();

    const appLabel = target === 'frontend' ? 'app-frontend' : 'app-backend';

    const args = [
      'logs',
      '-n', this.config.namespace,
      '-l', `app=${appLabel}`,
      `--tail=${tail}`,
    ];

    if (follow) {
      args.push('-f');
    }

    console.log('');
    const result = spawnSync('kubectl', args, { stdio: 'inherit' });

    return result.status === 0 ? 0 : 1;
  }

  // ============================================================
  // Port Forward Commands
  // ============================================================

  async cmdPortForward(targetArg?: string): Promise<number> {
    this.initConfig();
    const target = this.parseLogTarget(targetArg || this.args[0]);

    lib.log.header('Port Forward');

    if (!this.clusterExists()) {
      lib.log.fail(`Cluster '${this.config.clusterName}' does not exist`);
      return 1;
    }

    this.switchContext();

    const service = target === 'frontend' ? 'app-frontend' : 'app-backend';
    const localPort = target === 'frontend' ? this.config.frontendPort : this.config.backendPort;
    const targetPort = target === 'frontend' ? 3000 : 8000;

    lib.log.info(`Service: ${service}`);
    lib.log.info(`Forwarding: localhost:${localPort} -> ${service}:${targetPort}`);
    console.log('');
    lib.log.info('Press Ctrl+C to stop');
    console.log('');

    const result = spawnSync('kubectl', [
      'port-forward',
      '-n', this.config.namespace,
      `svc/${service}`,
      `${localPort}:${targetPort}`,
    ], { stdio: 'inherit' });

    return result.status === 0 ? 0 : 1;
  }

  // ============================================================
  // Info Command
  // ============================================================

  async cmdInfo(): Promise<number> {
    this.initConfig();

    lib.log.header('Kind Configuration');

    lib.log.section('Cluster');
    console.log(`  Cluster Name:     ${this.config.clusterName}`);
    console.log(`  Context:          ${this.getClusterContext()}`);
    console.log(`  Namespace:        ${this.config.namespace}`);
    console.log(`  Status:           ${this.clusterExists() ? lib.c.green('Running') : lib.c.red('Not Running')}`);

    lib.log.section('Docker Images');
    console.log(`  Backend:          ${this.config.backendImage}:latest`);
    console.log(`  Frontend:         ${this.config.frontendImage}:latest`);

    lib.log.section('Ports');
    console.log(`  Backend:          ${this.config.backendPort}`);
    console.log(`  Frontend:         ${this.config.frontendPort}`);

    lib.log.section('Paths');
    console.log(`  Root:             ${ROOT_DIR}`);
    console.log(`  Backend Dir:      ${PATHS.backendDir}`);
    console.log(`  Frontend Dir:     ${PATHS.frontendDir}`);
    console.log(`  Local Overlay:    ${this.config.localOverlay}`);
    console.log(`  Cluster Config:   ${this.config.clusterConfigPath}`);

    lib.log.section('Quick Commands');
    console.log('  Full pipeline:    npx tsx kind-manage.ts build-deploy');
    console.log('  Check status:     npx tsx kind-manage.ts status');
    console.log('  View logs:        npx tsx kind-manage.ts logs');

    return 0;
  }
}

KindManage.main();
