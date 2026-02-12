/**
 * ManageDatabase UseCase
 *
 * Manages database operations on EKS via bastion host:
 * - deploy: Install CNPG operator and PostgreSQL cluster
 * - migrate: Run Prisma migrations
 * - seed: Seed database with initial data
 * - status: Check database status
 * - secrets: Create app-backend-secrets
 * - auth: Setup AUTH_SERVICE_URL
 */

import * as path from 'path';
import { execSync } from 'child_process';
import type { InfraContainer } from '../../container/types.js';
import { UseCase, type UseCaseResult } from '../base/UseCase.js';
import { DatabaseOperatorError } from '../../domain/errors/index.js';
import { log as defaultLog } from '../../framework/logging/index.js';
import { SSMCommandRunner } from '../../infrastructure/aws/runtime/SSMCommandRunner.js';
import { CommandBuilder } from '../../framework/command/CommandBuilder.js';

/**
 * Database command type.
 */
export type DatabaseCommand = 'deploy' | 'migrate' | 'seed' | 'status' | 'secrets' | 'auth' | 'cluster' | 'describe' | 'logs';

/**
 * Input for database management.
 */
export interface ManageDatabaseInput {
  /** Command to execute */
  command: DatabaseCommand;
  /** AWS region */
  region: string;
  /** Cluster name */
  clusterName: string;
  /** Bastion instance ID */
  bastionId: string;
  /** Kustomize overlay */
  overlay: string;
  /** CNPG K8s directory */
  cnpgDir: string;
  /** CNPG operator URL */
  cnpgOperatorUrl: string;
  /** PostgreSQL app user */
  pgAppUser: string;
  /** PostgreSQL app password */
  pgAppPassword: string;
  /** PostgreSQL superuser password */
  pgSuperPassword: string;
  /** JWT secret */
  jwtSecret: string;
  /** Auth service URL */
  authServiceUrl: string;
}

/**
 * Output from database management.
 */
export interface ManageDatabaseOutput {
  /** Command executed */
  command: DatabaseCommand;
  /** Whether the command succeeded */
  commandSuccess: boolean;
  /** Output from SSM command */
  output?: string;
}

/**
 * Manages database operations via SSM commands.
 */
export class ManageDatabase extends UseCase<ManageDatabaseInput, ManageDatabaseOutput> {
  constructor(container: InfraContainer) {
    super(container);
  }

  async execute(input: ManageDatabaseInput): Promise<UseCaseResult<ManageDatabaseOutput>> {
    this.startTimer();
    const log = defaultLog;

    try {
      // Create SSM runner
      const ssmRunner = new SSMCommandRunner(input.bastionId, input.region);

      let commandSuccess = false;

      switch (input.command) {
        case 'deploy':
          await this.runPhase('action', 'Deploy Database', 'Deploying CNPG and PostgreSQL', async () => {
            commandSuccess = await this.deployDatabase(ssmRunner, input);
          });
          break;

        case 'migrate':
          await this.runPhase('action', 'Migrate', 'Running database migrations', async () => {
            commandSuccess = await this.runMigration(ssmRunner, input);
          });
          break;

        case 'seed':
          await this.runPhase('action', 'Seed', 'Seeding database', async () => {
            commandSuccess = await this.runSeed(ssmRunner, input);
          });
          break;

        case 'status':
          await this.runPhase('setup', 'Status', 'Checking database status', async () => {
            commandSuccess = await this.showStatus(ssmRunner, input);
          });
          break;

        case 'secrets':
          await this.runPhase('action', 'Secrets', 'Creating app-backend-secrets', async () => {
            commandSuccess = await this.createSecrets(ssmRunner, input);
          });
          break;

        case 'auth':
          await this.runPhase('action', 'Auth Setup', 'Setting up AUTH_SERVICE_URL', async () => {
            commandSuccess = await this.setupAuth(ssmRunner, input);
          });
          break;

        case 'cluster':
          await this.runPhase('setup', 'Cluster Info', 'Showing CNPG cluster details', async () => {
            commandSuccess = await this.showCluster(ssmRunner, input);
          });
          break;

        case 'describe':
          await this.runPhase('setup', 'Describe', 'Describing PostgreSQL cluster', async () => {
            commandSuccess = await this.describeCluster(ssmRunner, input);
          });
          break;

        case 'logs':
          await this.runPhase('setup', 'Logs', 'Showing database logs', async () => {
            commandSuccess = await this.showLogs(ssmRunner, input);
          });
          break;

        default:
          throw new DatabaseOperatorError('ManageDatabase', `Unknown command: ${input.command}`);
      }

      if (!commandSuccess) {
        throw new DatabaseOperatorError('ManageDatabase', `Command '${input.command}' failed`);
      }

      return this.buildResult({
        command: input.command,
        commandSuccess,
      });

    } catch (error) {
      if (error instanceof Error) {
        return this.buildFailedResult(error);
      }
      return this.buildFailedResult(new Error(String(error)));
    }
  }

  // ============================================================
  // Command Implementations
  // ============================================================

  private async deployDatabase(ssmRunner: SSMCommandRunner, input: ManageDatabaseInput): Promise<boolean> {
    // Build Kustomize locally and base64 encode
    const kustomizePath = path.join(input.cnpgDir, 'overlays', input.overlay);
    let cnpgClusterYamlBase64: string;
    try {
      const cnpgClusterYaml = execSync(`kubectl kustomize ${kustomizePath}`, { encoding: 'utf-8' });
      cnpgClusterYamlBase64 = Buffer.from(cnpgClusterYaml).toString('base64');
    } catch (err) {
      throw new DatabaseOperatorError('Kustomize', `Failed to build: ${err}`);
    }

    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.setupKubeconfig(input.region, input.clusterName),
      [
        'echo "=== Installing CNPG Operator ==="',
        `kubectl apply --server-side=true --force-conflicts -f ${input.cnpgOperatorUrl}`,
        'kubectl wait --for=condition=Available deployment/cnpg-controller-manager -n cnpg-system --timeout=180s || echo "Timeout"',
        '',
        'echo "=== Creating database namespace ==="',
        'kubectl create namespace database --dry-run=client -o yaml | kubectl apply -f -',
        '',
        'echo "=== Creating PostgreSQL secrets ==="',
        `kubectl create secret generic pg-app-user -n database \\
          --from-literal=username=${input.pgAppUser} \\
          --from-literal=password='${input.pgAppPassword}' \\
          --dry-run=client -o yaml | kubectl apply -f -`,
        `kubectl create secret generic pg-superuser -n database \\
          --from-literal=username=postgres \\
          --from-literal=password='${input.pgSuperPassword}' \\
          --dry-run=client -o yaml | kubectl apply -f -`,
        '',
        'echo "=== Applying PostgreSQL Cluster ==="',
        `echo '${cnpgClusterYamlBase64}' | base64 -d | kubectl apply -f -`,
        '',
        'echo "=== Waiting for PostgreSQL Cluster ==="',
        'for i in {1..30}; do',
        '  STATUS=$(kubectl get cluster app-postgres -n database -o jsonpath="{.status.phase}" 2>/dev/null || echo "NotFound")',
        '  echo "Cluster status: $STATUS (attempt $i/30)"',
        '  if [ "$STATUS" = "Cluster in healthy state" ]; then break; fi',
        '  sleep 10',
        'done',
        '',
        'echo "=== Final Status ==="',
        'kubectl get cluster -n database',
        'kubectl get pods -n database -o wide',
      ],
    ]);

    const result = await ssmRunner.execute(cmds, { label: 'Database deploy', timeout: 420 });
    return result.success;
  }

  private async runMigration(ssmRunner: SSMCommandRunner, input: ManageDatabaseInput): Promise<boolean> {
    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.setupKubeconfig(input.region, input.clusterName),
      [
        'echo "=== Running Database Migration ==="',
        'if ! kubectl get deploy app-backend -n app >/dev/null 2>&1; then',
        '  echo "Error: app-backend deployment not found"',
        '  exit 1',
        'fi',
        'kubectl exec -n app deploy/app-backend -- npx prisma migrate deploy',
        'echo "=== Syncing Schema ==="',
        'kubectl exec -n app deploy/app-backend -- npx prisma db push --skip-generate',
        'echo "=== Migration Complete ==="',
      ],
    ]);

    const result = await ssmRunner.execute(cmds, { label: 'DB migrate', timeout: 120 });
    return result.success;
  }

  private async runSeed(ssmRunner: SSMCommandRunner, input: ManageDatabaseInput): Promise<boolean> {
    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.setupKubeconfig(input.region, input.clusterName),
      [
        'echo "=== Seeding Database ==="',
        'if ! kubectl get deploy app-backend -n app >/dev/null 2>&1; then',
        '  echo "Error: app-backend deployment not found"',
        '  exit 1',
        'fi',
        'kubectl exec -n app deploy/app-backend -- npm run db:seed',
        'echo "=== Seed Complete ==="',
      ],
    ]);

    const result = await ssmRunner.execute(cmds, { label: 'DB seed', timeout: 60 });
    return result.success;
  }

  private async showStatus(ssmRunner: SSMCommandRunner, input: ManageDatabaseInput): Promise<boolean> {
    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.setupKubeconfig(input.region, input.clusterName),
      [
        'echo "=== CNPG Operator ==="',
        'kubectl get pods -n cnpg-system 2>/dev/null || echo "CNPG operator not installed"',
        'echo "=== PostgreSQL Cluster ==="',
        'kubectl get cluster -n database 2>/dev/null || echo "No cluster found"',
        'echo "=== Database Pods ==="',
        'kubectl get pods -n database -o wide 2>/dev/null || echo "No pods found"',
        'echo "=== Database Services ==="',
        'kubectl get svc -n database 2>/dev/null || echo "No services found"',
      ],
    ]);

    const result = await ssmRunner.execute(cmds, { label: 'DB status', timeout: 30 });
    return result.success;
  }

  private async createSecrets(ssmRunner: SSMCommandRunner, input: ManageDatabaseInput): Promise<boolean> {
    const databaseUrl = `postgresql://${input.pgAppUser}:${input.pgAppPassword}@app-postgres-rw.database.svc.cluster.local:5432/appdb`;

    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.setupKubeconfig(input.region, input.clusterName),
      [
        'echo "=== Creating App Backend Secrets ==="',
        'kubectl create namespace app --dry-run=client -o yaml | kubectl apply -f -',
        `kubectl create secret generic app-backend-secrets -n app \\
          --from-literal=DATABASE_URL='${databaseUrl}' \\
          --from-literal=JWT_SECRET='${input.jwtSecret}' \\
          --dry-run=client -o yaml | kubectl apply -f -`,
        'echo "=== Secrets Created ==="',
        'kubectl get secrets -n app | grep app-backend',
      ],
    ]);

    const result = await ssmRunner.execute(cmds, { label: 'Create secrets', timeout: 60 });
    return result.success;
  }

  private async setupAuth(ssmRunner: SSMCommandRunner, input: ManageDatabaseInput): Promise<boolean> {
    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.setupKubeconfig(input.region, input.clusterName),
      [
        'echo "=== Setting AUTH_SERVICE_URL ==="',
        'if ! kubectl get deploy app-backend -n app >/dev/null 2>&1; then',
        '  echo "Error: app-backend deployment not found"',
        '  exit 1',
        'fi',
        `kubectl set env deployment/app-backend -n app AUTH_SERVICE_URL=${input.authServiceUrl}`,
        'echo "=== Restarting Backend ==="',
        'kubectl rollout restart deployment/app-backend -n app',
        'kubectl rollout status deployment/app-backend -n app --timeout=120s',
        'echo "=== Auth Setup Complete ==="',
      ],
    ]);

    const result = await ssmRunner.execute(cmds, { label: 'Auth setup', timeout: 180 });
    return result.success;
  }

  private async showCluster(ssmRunner: SSMCommandRunner, input: ManageDatabaseInput): Promise<boolean> {
    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.setupKubeconfig(input.region, input.clusterName),
      [
        'echo "=== CNPG Cluster ==="',
        'kubectl get cluster -n database -o wide 2>/dev/null || echo "No cluster found"',
        'echo "=== Cluster Status ==="',
        "kubectl get cluster app-postgres -n database -o jsonpath='{.status}' 2>/dev/null | jq . || echo \"Cluster not found\"",
        'echo "=== Cluster Instances ==="',
        'kubectl get pods -n database -l cnpg.io/cluster=app-postgres -o wide 2>/dev/null || echo "No pods found"',
      ],
    ]);

    const result = await ssmRunner.execute(cmds, { label: 'DB cluster', timeout: 30 });
    return result.success;
  }

  private async describeCluster(ssmRunner: SSMCommandRunner, input: ManageDatabaseInput): Promise<boolean> {
    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.setupKubeconfig(input.region, input.clusterName),
      [
        'echo "=== Describe Cluster ==="',
        'kubectl describe cluster app-postgres -n database 2>/dev/null || echo "Cluster not found"',
        'echo "=== Database Events ==="',
        "kubectl get events -n database --sort-by='.lastTimestamp' 2>/dev/null | tail -20 || echo \"No events\"",
      ],
    ]);

    const result = await ssmRunner.execute(cmds, { label: 'DB describe', timeout: 30 });
    return result.success;
  }

  private async showLogs(ssmRunner: SSMCommandRunner, input: ManageDatabaseInput): Promise<boolean> {
    const cmds = CommandBuilder.join([
      CommandBuilder.preamble(),
      CommandBuilder.setupKubeconfig(input.region, input.clusterName),
      [
        'echo "=== Database Pod Logs ==="',
        'kubectl logs -n database -l cnpg.io/cluster=app-postgres --tail=100 2>/dev/null || echo "No pods found"',
      ],
    ]);

    const result = await ssmRunner.execute(cmds, { label: 'DB logs', timeout: 30 });
    return result.success;
  }
}
