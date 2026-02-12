#!/usr/bin/env npx tsx
/**
 * Bastion Connection Script
 * Connect to bastion host via SSM Session Manager
 */

import { spawnSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import {
  toError,
  safeParseJson,
  SSMInstanceInfoSchema,
  EC2SingleInstanceSchema,
} from '../../infrastructure/types.js';
import type { TerraformOutputs } from '../../infrastructure/types.js';
import type { CommandDefinition, OptionDefinition } from '../../framework/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SSMStatus {
  status: string;
  lastPing: string;
  agentVersion?: string;
  platformType?: string;
  platformName?: string;
}

interface EC2Status {
  state: string;
  type: string;
  az: string;
  privateIp: string;
  publicIp: string;
  launchTime: string;
}

class BastionConnect extends InfraCommand {
  static override name = 'bastion-connect';
  static override description = 'Bastion Host Connection Tool (SSM Session Manager)';

  static override commands: Record<string, CommandDefinition> = {
    connect: { desc: 'Start SSM session to bastion', aliases: ['ssh', 'c'], requireAws: true },
    status: { desc: 'Show bastion instance status', aliases: ['st', 's'], requireAws: true },
    start: { desc: 'Start bastion instance', requireAws: true },
    stop: { desc: 'Stop bastion instance', requireAws: true },
    tunnel: { desc: 'Start port forwarding tunnel', args: '<local-port> <remote-port>', aliases: ['pf'], requireAws: true },
    'port-forward': { desc: 'Port-forward K8s service (grafana:3000, prometheus:9090)', args: '<service> [namespace]', aliases: ['pf-svc'], requireAws: true },
    exec: { desc: 'Execute command on bastion', args: '<command...>', aliases: ['run', 'x'], requireAws: true },
    kubectl: { desc: 'Run kubectl on bastion (auto kubeconfig)', args: '<kubectl-args...>', aliases: ['k'], requireAws: true },
    setup: { desc: 'Setup kubectl, helm, and tools on bastion', requireAws: true },
    info: { desc: 'Show bastion configuration', aliases: ['i'], requireAws: true },
    sync: { desc: 'Sync workspace to bastion via S3', aliases: ['rs'], requireAws: true },
  };

  static override options: Record<string, OptionDefinition> = {
    '--tf-dir': { name: 'tfDir', type: 'string', desc: 'Terraform directory' },
    '--instance-id': { name: 'instanceId', type: 'string', desc: 'Override instance ID' },
  };

  private tfDir: string;
  private tf: TerraformOutputs | null = null;
  private instanceId: string | null = null;

  constructor() {
    super();
    // Terraform is at infra/terraform/prod, not scripts/infra/terraform/prod
    this.tfDir = path.resolve(__dirname, '../../../../infra/terraform/prod');
  }

  // ============================================================
  // Helpers
  // ============================================================

  private initTerraform(): boolean {
    const tfDir = (this.options.tfDir as string) || this.tfDir;
    this.tf = lib.createTerraformOutputs(tfDir);
    const rawInstanceId = (this.options.instanceId as string) || this.tf.bastionId();

    if (!rawInstanceId) {
      lib.log.fail('Bastion instance ID not found. Run terraform apply first or use --instance-id');
      return false;
    }

    try {
      this.instanceId = lib.validateInstanceId(rawInstanceId);
    } catch (e: unknown) {
      lib.log.fail(toError(e).message);
      return false;
    }
    return true;
  }

  private getSSMStatus(): SSMStatus {
    const result = lib.aws(
      `ssm describe-instance-information --filters "Key=InstanceIds,Values=${this.instanceId}" --output json`,
      { ignoreError: true, region: this.region }
    );

    if (!result) return { status: 'Unknown', lastPing: '-' };

    const data = safeParseJson(result, SSMInstanceInfoSchema);
    if (!data) return { status: 'Unknown', lastPing: '-' };

    const info = data.InstanceInformationList?.[0];
    if (!info) return { status: 'NOT_CONNECTED', lastPing: '-' };

    return {
      status: info.PingStatus || 'Unknown',
      lastPing: info.LastPingDateTime || '-',
      agentVersion: info.AgentVersion || '-',
      platformType: info.PlatformType || '-',
      platformName: info.PlatformName || '-',
    };
  }

  private getEC2Status(): EC2Status | null {
    const result = lib.aws(
      `ec2 describe-instances --instance-ids ${this.instanceId} --query 'Reservations[0].Instances[0]' --output json`,
      { ignoreError: true, region: this.region }
    );

    if (!result) return null;

    const instance = safeParseJson(result, EC2SingleInstanceSchema);
    if (!instance) return null;

    return {
      state: instance.State?.Name || 'unknown',
      type: instance.InstanceType || '-',
      az: instance.Placement?.AvailabilityZone || '-',
      privateIp: instance.PrivateIpAddress || '-',
      publicIp: instance.PublicIpAddress || '-',
      launchTime: instance.LaunchTime || '-',
    };
  }

  // ============================================================
  // Commands
  // ============================================================

  async cmdConnect(): Promise<number> {
    if (!this.initTerraform()) return 1;

    // 起 (Context)
    lib.showContext('bastion-connect', {
      bastionId: this.instanceId || '-',
      region: this.region,
    });

    // Check SSM status first
    const ssm = this.getSSMStatus();
    if (ssm.status !== 'Online') {
      lib.log.warn(`SSM Status: ${ssm.status}`);
      lib.log.info('Waiting for SSM agent to come online...');

      // Wait up to 60 seconds
      for (let i = 0; i < 12; i++) {
        await lib.sleep(5000);
        const status = this.getSSMStatus();
        if (status.status === 'Online') {
          lib.log.pass('SSM agent is now online');
          break;
        }
        process.stdout.write('.');
      }
      console.log('');
    }

    lib.log.info('Starting SSM session...');
    console.log('');

    // Start interactive session
    const cmd = `aws ssm start-session --target ${this.instanceId} --region ${this.region}`;
    lib.log.info(`Command: ${cmd}`);
    console.log('');

    spawnSync('aws', ['ssm', 'start-session', '--target', this.instanceId!, '--region', this.region], {
      stdio: 'inherit',
    });

    return 0;
  }

  async cmdStatus(): Promise<number> {
    if (!this.initTerraform()) return 1;

    // 起 (Context)
    lib.showContext('bastion-status', {
      bastionId: this.instanceId || '-',
      region: this.region,
    });

    // EC2 status
    lib.log.section('EC2 Instance');
    const ec2 = this.getEC2Status();
    if (ec2) {
      const stateColor = ec2.state === 'running' ? lib.c.green : lib.c.yellow;
      console.log(`  Instance ID:  ${this.instanceId}`);
      console.log(`  State:        ${stateColor(ec2.state)}`);
      console.log(`  Type:         ${ec2.type}`);
      console.log(`  AZ:           ${ec2.az}`);
      console.log(`  Private IP:   ${ec2.privateIp}`);
      console.log(`  Public IP:    ${ec2.publicIp || 'None'}`);
      console.log(`  Launch Time:  ${ec2.launchTime}`);
    } else {
      lib.log.fail('Failed to get EC2 instance info');
    }

    // SSM status
    lib.log.section('SSM Agent');
    const ssm = this.getSSMStatus();
    const ssmColor = ssm.status === 'Online' ? lib.c.green : lib.c.yellow;
    console.log(`  Status:       ${ssmColor(ssm.status)}`);
    console.log(`  Last Ping:    ${ssm.lastPing}`);
    if (ssm.agentVersion) {
      console.log(`  Agent:        ${ssm.agentVersion}`);
      console.log(`  Platform:     ${ssm.platformName}`);
    }

    // Connection command
    if (ssm.status === 'Online') {
      lib.log.section('Connect Command');
      console.log(`  node bastion-connect.js connect`);
      console.log(`  # or: aws ssm start-session --target ${this.instanceId}`);
    }

    return 0;
  }

  async cmdStart(): Promise<number> {
    if (!this.initTerraform()) return 1;

    lib.log.header('Start Bastion Instance');

    const ec2 = this.getEC2Status();
    if (ec2?.state === 'running') {
      lib.log.pass('Instance is already running');
      return 0;
    }

    lib.log.info(`Starting instance: ${this.instanceId}`);
    lib.aws(`ec2 start-instances --instance-ids ${this.instanceId}`, { region: this.region });

    lib.log.info('Waiting for instance to start...');
    lib.aws(`ec2 wait instance-running --instance-ids ${this.instanceId}`, { region: this.region });
    lib.log.pass('Instance is running');

    lib.log.info('Waiting for SSM agent...');
    for (let i = 0; i < 24; i++) {
      await lib.sleep(5000);
      const ssm = this.getSSMStatus();
      if (ssm.status === 'Online') {
        lib.log.pass('SSM agent is online');
        return 0;
      }
      process.stdout.write('.');
    }
    console.log('');
    lib.log.warn('SSM agent not yet online. Try again in a minute.');

    return 0;
  }

  async cmdStop(): Promise<number> {
    if (!this.initTerraform()) return 1;

    lib.log.header('Stop Bastion Instance');

    const ec2 = this.getEC2Status();
    if (ec2?.state === 'stopped') {
      lib.log.pass('Instance is already stopped');
      return 0;
    }

    if (!await lib.confirm(`Stop bastion instance ${this.instanceId}?`)) {
      lib.log.info('Cancelled');
      return 0;
    }

    lib.log.info(`Stopping instance: ${this.instanceId}`);
    lib.aws(`ec2 stop-instances --instance-ids ${this.instanceId}`, { region: this.region });

    lib.log.info('Waiting for instance to stop...');
    lib.aws(`ec2 wait instance-stopped --instance-ids ${this.instanceId}`, { region: this.region });
    lib.log.pass('Instance stopped');

    return 0;
  }

  async cmdTunnel(localPort?: string, remotePort?: string): Promise<number> {
    if (!this.initTerraform()) return 1;

    if (!localPort || !remotePort) {
      lib.log.fail('Usage: node bastion-connect.js tunnel <local-port> <remote-port>');
      lib.log.info('Example: node bastion-connect.js tunnel 8443 443');
      return 1;
    }

    // Validate port numbers
    let validatedLocalPort: string;
    let validatedRemotePort: string;
    try {
      validatedLocalPort = lib.validatePort(localPort, 'local port');
      validatedRemotePort = lib.validatePort(remotePort, 'remote port');
    } catch (e: unknown) {
      lib.log.fail(toError(e).message);
      return 1;
    }

    lib.log.header('SSM Port Forwarding');
    lib.log.info(`Instance: ${this.instanceId}`);
    lib.log.info(`Tunnel: localhost:${validatedLocalPort} -> bastion:${validatedRemotePort}`);

    console.log('');
    lib.log.info('Starting port forwarding...');
    lib.log.info('Press Ctrl+C to stop');
    console.log('');

    spawnSync('aws', [
      'ssm', 'start-session',
      '--target', this.instanceId!,
      '--document-name', 'AWS-StartPortForwardingSession',
      '--parameters', JSON.stringify({ portNumber: [validatedRemotePort], localPortNumber: [validatedLocalPort] }),
      '--region', this.region,
    ], {
      stdio: 'inherit',
    });

    return 0;
  }

  /**
   * K8s サービスへの Port-forward（監視系UIなど）
   * 1. Bastion で kubectl port-forward を開始
   * 2. SSM port forward で WSL からアクセス
   */
  async cmdPortForward(service?: string, namespace?: string): Promise<number> {
    if (!this.initTerraform()) return 1;

    const svc = service || this.args[0];
    const ns = namespace || this.args[1] || 'monitoring';

    // サービス → ポートマッピング
    const servicePortMap: Record<string, { port: number; svcPort?: number; info: string }> = {
      grafana: { port: 3000, info: 'Login: admin/(see grafana secret)' },
      prometheus: { port: 9090, info: '' },
      alertmanager: { port: 9093, info: '' },
      loki: { port: 3100, info: '' },
      'argocd-server': { port: 8080, svcPort: 443, info: 'Login: admin / (see: kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath={.data.password} | base64 -d)' },
      'app-postgres-rw': { port: 5432, info: 'PostgreSQL Primary (RW). Connect with DBeaver: localhost:5432, appuser, appdb' },
      'app-postgres-ro': { port: 5433, svcPort: 5432, info: 'PostgreSQL Replica (RO). Connect with DBeaver: localhost:5433' },
    };

    if (!svc || !servicePortMap[svc]) {
      lib.log.fail(`Usage: port-forward <service> [namespace]`);
      lib.log.info(`Services: ${Object.keys(servicePortMap).join(', ')}`);
      return 1;
    }

    const { port, svcPort, info } = servicePortMap[svc];
    const targetPort = svcPort || port;  // サービス側ポート (svcPort が未指定なら port と同じ)
    const clusterName = this.tf?.get('cluster_name') || 'prod-eks-cluster';
    const kubeconfigPath = '/tmp/.kube/config';

    lib.log.header(`Port Forward: ${svc}`);
    lib.log.info(`Service:   svc/${svc} (namespace: ${ns})`);
    lib.log.info(`Port:      localhost:${port} -> svc:${targetPort}`);
    console.log('');

    // Step 1: Bastion で kubectl port-forward を開始
    lib.log.section('Step 1: Start kubectl port-forward on Bastion');

    // バックグラウンド実行は単一のシェルスクリプトとして実行
    const fullCommand = `
      set -e
      export PATH=/usr/local/bin:$PATH
      export KUBECONFIG=${kubeconfigPath}
      mkdir -p /tmp/.kube
      aws eks update-kubeconfig --region ${this.region} --name ${clusterName} --kubeconfig ${kubeconfigPath} >/dev/null 2>&1
      pkill -f 'kubectl.*port-forward.*${svc}' 2>/dev/null || true
      nohup kubectl -n ${ns} port-forward --address 0.0.0.0 svc/${svc} ${port}:${targetPort} > /tmp/${svc}-pf.log 2>&1 &
      sleep 2
      cat /tmp/${svc}-pf.log 2>/dev/null || echo "Port forward started"
    `.trim();

    const ssm = new lib.SSMCommandRunner(this.instanceId!, this.region);
    const result = await ssm.execute(fullCommand, {
      timeout: 30,
      label: 'kubectl port-forward',
      stream: false,
    });

    if (!result.success) {
      lib.log.fail(`Failed to start port-forward: ${result.error || 'unknown error'}`);
      return 1;
    }

    lib.log.pass('kubectl port-forward started on Bastion');

    // Step 2: SSM port forward
    lib.log.section('Step 2: SSM Port Forwarding');
    console.log('');
    console.log(`  Access: http://localhost:${port}`);
    if (info) console.log(`  ${info}`);
    console.log('');
    console.log('  Ctrl+C to close');
    console.log('');

    spawnSync('aws', [
      'ssm', 'start-session',
      '--target', this.instanceId!,
      '--document-name', 'AWS-StartPortForwardingSession',
      '--parameters', JSON.stringify({ portNumber: [String(port)], localPortNumber: [String(port)] }),
      '--region', this.region,
    ], {
      stdio: 'inherit',
    });

    return 0;
  }

  async cmdExec(...commandParts: string[]): Promise<number> {
    if (!this.initTerraform()) return 1;

    const command = commandParts.join(' ') || this.args.join(' ');
    if (!command) {
      lib.log.fail('Usage: node bastion-connect.js exec <command>');
      lib.log.info('Example: node bastion-connect.js exec "kubectl get nodes"');
      return 1;
    }

    // Validate command for dangerous patterns
    try {
      lib.validateCommand(command);
    } catch (e: unknown) {
      lib.log.fail(toError(e).message);
      return 1;
    }

    lib.log.header('Execute on Bastion');
    lib.log.info(`Instance: ${this.instanceId}`);
    lib.log.info(`Command: ${command}`);
    console.log('');

    // SSM send-command runs in non-login shell without HOME set
    // This breaks kubectl/helm which need ~/.kube/config and ~/.config/helm
    const fullCommand = `export HOME=/root && ${command}`;

    const ssm = new lib.SSMCommandRunner(this.instanceId!, this.region);
    const result = await ssm.execute(fullCommand, { timeout: 120, label: command, stream: true });

    if (!result.success) {
      lib.log.fail(`Command failed: ${result.error || result.status}`);
      return 1;
    }

    return 0;
  }

  /**
   * kubectl コマンドを Bastion 経由で実行
   * kubeconfig を自動セットアップして kubectl を実行する
   * Makefile から直接呼び出せるよう、出力は最小限（結果のみ）
   *
   * stdin support: When using `-f -`, reads YAML from stdin and embeds it in the command
   */
  async cmdKubectl(..._kubectlArgs: string[]): Promise<number> {
    if (!this.initTerraform()) return 1;

    // Get raw args after 'kubectl' command (bypasses parseArgs which strips - prefixed args)
    const rawArgv = process.argv.slice(2);
    const kubectlIndex = rawArgv.indexOf('kubectl');
    const rawKubectlArgs = kubectlIndex >= 0 ? rawArgv.slice(kubectlIndex + 1) : [];

    let args = rawKubectlArgs.join(' ');
    if (!args) {
      lib.log.fail('Usage: bastion-connect.ts kubectl <kubectl-args>');
      lib.log.info('Example: bastion-connect.ts kubectl get pods -n mlops');
      return 1;
    }

    // Handle stdin input for `-f -` pattern
    let stdinContent = '';
    const needsStdin = args.includes('-f -') || args.includes('-f-');
    if (needsStdin && !process.stdin.isTTY) {
      stdinContent = await new Promise<string>((resolve) => {
        const chunks: Buffer[] = [];
        process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
        process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        process.stdin.on('error', () => resolve(''));
      });
    }

    // EKS cluster name from terraform or default
    const clusterName = this.tf?.get('cluster_name') || 'prod-eks-cluster';
    const kubeconfigPath = '/tmp/.kube/config';

    // Build command with kubeconfig setup
    const setupCmd = [
      'export PATH=/usr/local/bin:$PATH',
      `export KUBECONFIG=${kubeconfigPath}`,
      'mkdir -p /tmp/.kube',
      `aws eks update-kubeconfig --region ${this.region} --name ${clusterName} --kubeconfig ${kubeconfigPath} >/dev/null 2>&1`,
    ].join(' && ');

    let fullCommand: string;
    if (stdinContent) {
      // Use base64 encoding to safely pass YAML through SSM
      const base64Content = Buffer.from(stdinContent).toString('base64');
      fullCommand = `${setupCmd} && echo '${base64Content}' | base64 -d | kubectl ${args}`;
    } else {
      fullCommand = `${setupCmd} && kubectl ${args}`;
    }

    const ssm = new lib.SSMCommandRunner(this.instanceId!, this.region);
    const result = await ssm.execute(fullCommand, {
      timeout: 120,
      label: `kubectl ${args.split(' ')[0]}`,
      stream: false, // Don't stream, just return output
    });

    // Output result directly (for Makefile piping)
    if (result.output) {
      console.log(result.output.trim());
    }

    if (!result.success) {
      if (result.error) {
        console.error(result.error);
      }
      return 1;
    }

    return 0;
  }

  /**
   * Bastion にツール（kubectl, helm等）をセットアップ
   * 冪等性あり - 既にインストール済みの場合はスキップ
   */
  async cmdSetup(): Promise<number> {
    if (!this.initTerraform()) return 1;

    // 起 (Context)
    lib.showContext('bastion-setup', {
      bastionId: this.instanceId || '-',
    });

    const ssm = new lib.SSMCommandRunner(this.instanceId!, this.region);

    // Define tools with version and install commands
    const tools = [
      {
        name: 'make',
        version: 'system',
        check: 'which make >/dev/null 2>&1 && echo "installed" || echo "not installed"',
        install: 'sudo dnf install -y make',
      },
      {
        name: 'nodejs',
        version: 'v20.x',
        check: 'node --version 2>/dev/null || echo "not installed"',
        install: [
          'curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -',
          'sudo dnf install -y nodejs',
        ].join(' && '),
      },
      {
        name: 'kubectl',
        version: 'v1.29.12',
        check: 'kubectl version --client --short 2>/dev/null || echo "not installed"',
        install: [
          'curl -fLO https://dl.k8s.io/release/v1.29.12/bin/linux/amd64/kubectl',
          'chmod +x kubectl',
          'sudo mv kubectl /usr/local/bin/kubectl',
        ].join(' && '),
      },
      {
        name: 'helm',
        version: 'v3.14.0',
        check: 'helm version --short 2>/dev/null || echo "not installed"',
        install: [
          'curl -fsSL https://get.helm.sh/helm-v3.14.0-linux-amd64.tar.gz | tar xz',
          'sudo mv linux-amd64/helm /usr/local/bin/helm',
          'rm -rf linux-amd64',
        ].join(' && '),
      },
    ];

    for (const tool of tools) {
      lib.log.section(`${tool.name} (${tool.version})`);

      // Check if installed
      const checkResult = await ssm.execute(tool.check, { timeout: 30, stream: false });
      const output = checkResult.output?.trim() || '';

      if (output.includes('not installed') || !checkResult.success) {
        lib.log.info(`Installing ${tool.name}...`);
        const installResult = await ssm.execute(tool.install, { timeout: 120, stream: true });
        if (!installResult.success) {
          lib.log.fail(`Failed to install ${tool.name}: ${installResult.error || 'unknown error'}`);
          return 1;
        }
        lib.log.pass(`${tool.name} installed`);
      } else {
        lib.log.pass(`Already installed: ${output}`);
      }
    }

    console.log('');
    lib.log.pass('Setup complete');
    return 0;
  }

  async cmdInfo(): Promise<number> {
    if (!this.initTerraform()) return 1;

    lib.log.header('Bastion Configuration');

    console.log(`  Instance ID:     ${this.instanceId}`);
    console.log(`  Region:          ${this.region}`);
    console.log(`  Terraform Dir:   ${this.tfDir}`);

    // Show terraform outputs
    lib.log.section('Terraform Outputs');
    const connectCmd = this.tf!.get('bastion_connect_command');
    if (connectCmd) {
      console.log(`  Connect Command: ${connectCmd}`);
    }

    const bastionSg = this.tf!.get('bastion_security_group_id');
    if (bastionSg) {
      console.log(`  Security Group:  ${bastionSg}`);
    }

    // Quick commands
    lib.log.section('Quick Commands');
    console.log('  node bastion-connect.js connect     # Start SSM session');
    console.log('  node bastion-connect.js status      # Check status');
    console.log('  node bastion-connect.js exec "cmd"  # Run command');
    console.log('  node bastion-connect.js tunnel 8443 443  # Port forward');

    return 0;
  }

  /**
   * ローカルワークスペースをS3経由でBastionに同期
   *
   * フロー:
   * 1. ローカル → S3 (aws s3 sync)
   * 2. S3 → Bastion (SSM exec: aws s3 sync)
   */
  async cmdSync(): Promise<number> {
    if (!this.initTerraform()) return 1;

    const s3Bucket = this.tf!.get('s3_bucket_name');
    if (!s3Bucket) {
      lib.log.fail('S3 bucket not found in terraform outputs');
      return 1;
    }

    const s3Prefix = 'bastion-workspace';
    const bastionWorkspace = '/home/ec2-user/workspace';
    const projectRoot = path.resolve(__dirname, '../../../..');

    // 同期対象ディレクトリ
    const syncDirs = ['infra', 'scripts', 'makefiles', 'Makefile'];

    lib.log.header('Sync Workspace to Bastion');
    lib.log.info(`S3 Bucket: ${s3Bucket}`);
    lib.log.info(`S3 Prefix: ${s3Prefix}`);
    lib.log.info(`Bastion Path: ${bastionWorkspace}`);
    console.log('');

    // Step 1: ローカル → S3
    lib.log.section('Step 1: Upload to S3');
    for (const dir of syncDirs) {
      const localPath = path.join(projectRoot, dir);
      const s3Path = `s3://${s3Bucket}/${s3Prefix}/${dir}`;

      // ファイルかディレクトリかで処理を分ける
      const isFile = dir === 'Makefile';

      if (isFile) {
        lib.log.info(`Uploading: ${dir}`);
        const result = lib.aws(`s3 cp ${localPath} ${s3Path}`, { region: this.region, ignoreError: true });
        if (!result) {
          lib.log.warn(`Failed to upload ${dir}, skipping...`);
        }
      } else {
        lib.log.info(`Syncing: ${dir}/`);
        const result = lib.aws(`s3 sync ${localPath} ${s3Path} --delete`, { region: this.region, ignoreError: true });
        if (!result) {
          lib.log.warn(`Failed to sync ${dir}, skipping...`);
        }
      }
    }
    lib.log.pass('S3 upload complete');

    // Step 2: S3 → Bastion
    lib.log.section('Step 2: Download to Bastion');
    const ssm = new lib.SSMCommandRunner(this.instanceId!, this.region);

    // ワークスペースディレクトリ作成
    await ssm.execute(`mkdir -p ${bastionWorkspace}`, { timeout: 30, stream: false });

    // S3から同期
    const syncCmd = `aws s3 sync s3://${s3Bucket}/${s3Prefix}/ ${bastionWorkspace}/ --delete`;
    lib.log.info(`Command: ${syncCmd}`);

    const result = await ssm.execute(syncCmd, { timeout: 120, label: 's3 sync', stream: true });

    if (!result.success) {
      lib.log.fail(`Failed to sync from S3: ${result.error || 'unknown error'}`);
      return 1;
    }

    lib.log.pass('Bastion sync complete');
    console.log('');
    lib.log.info(`Workspace ready at: ${bastionWorkspace}`);
    lib.log.info('Next: make eks-bastion-kubectl CMD="get pods -n app"');
    lib.log.info('      make eks-bastion-apply OVERLAY=prod PATH=apps');

    return 0;
  }
}

BastionConnect.main();
