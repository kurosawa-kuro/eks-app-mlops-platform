#!/usr/bin/env npx tsx
/**
 * Database Deployment CLI
 *
 * Thin CLI wrapper for database operations on EKS via bastion host.
 *
 * Usage:
 *   npx tsx db-deploy.ts [deploy]    # Deploy CNPG operator + PostgreSQL cluster
 *   npx tsx db-deploy.ts migrate     # Run database migrations
 *   npx tsx db-deploy.ts seed        # Seed database with initial data
 *   npx tsx db-deploy.ts status      # Check PostgreSQL cluster status
 *   npx tsx db-deploy.ts secrets     # Create app-backend-secrets
 *   npx tsx db-deploy.ts auth        # Setup AUTH_SERVICE_URL
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import { createInfraContainer } from '../../container/index.js';
import { ManageDatabase, type DatabaseCommand } from '../../usecases/database/ManageDatabase.js';
import { createConfig } from '../../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { log, c } = lib;

/**
 * Database Deployment Command
 */
class DbDeployCommand extends InfraCommand {
  static name = 'db-deploy';
  static description = 'Manage database operations on EKS';
  static commands = {
    deploy: { desc: 'Deploy CNPG operator + PostgreSQL cluster', requireAws: true },
    migrate: { desc: 'Run database migrations', requireAws: true },
    seed: { desc: 'Seed database with initial data', requireAws: true },
    status: { desc: 'Check PostgreSQL cluster status', requireAws: true },
    secrets: { desc: 'Create app-backend-secrets', requireAws: true },
    auth: { desc: 'Setup AUTH_SERVICE_URL', requireAws: true },
    cluster: { desc: 'Show CNPG cluster details', requireAws: true },
    describe: { desc: 'Describe PostgreSQL cluster (verbose)', requireAws: true },
    logs: { desc: 'Show database pod logs', requireAws: true },
    help: { desc: 'Show help' },
  };

  private sharedConfig = createConfig();

  private getConfig() {
    return {
      region: this.sharedConfig.region,
      clusterName: this.sharedConfig.clusterName || '',
      bastionId: this.sharedConfig.bastionInstanceId || '',
      overlay: process.env.K8S_OVERLAY || 'prod',
      cnpgDir: path.resolve(__dirname, '../../../../infra/k8s/cnpg'),
      cnpgOperatorUrl: 'https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.25/releases/cnpg-1.25.0.yaml',
      pgAppUser: process.env.PG_APP_USER || 'appuser',
      pgAppPassword: process.env.PG_APP_PASSWORD || 'AppUser2024Secure!',
      pgSuperPassword: process.env.PG_SUPER_PASSWORD || 'SuperUser2024Secure!',
      jwtSecret: process.env.JWT_SECRET || 'your-production-jwt-secret-here-min-32-chars',
      authServiceUrl: process.env.AUTH_SERVICE_URL || 'https://your-auth-gateway.example.com',
    };
  }

  private async runCommand(command: DatabaseCommand): Promise<number> {
    const config = this.getConfig();

    console.log(c.bold(c.blue('Database Management')));
    console.log(c.dim(`Command: ${command}`));
    console.log(c.dim(`Overlay: ${config.overlay}`));
    console.log('');

    if (!config.bastionId) {
      log.fail('Bastion instance ID not found in Terraform outputs');
      return 1;
    }

    const container = createInfraContainer(config.cnpgDir);
    const useCase = new ManageDatabase(container);

    const result = await useCase.execute({
      command,
      region: config.region,
      clusterName: config.clusterName,
      bastionId: config.bastionId,
      overlay: config.overlay,
      cnpgDir: config.cnpgDir,
      cnpgOperatorUrl: config.cnpgOperatorUrl,
      pgAppUser: config.pgAppUser,
      pgAppPassword: config.pgAppPassword,
      pgSuperPassword: config.pgSuperPassword,
      jwtSecret: config.jwtSecret,
      authServiceUrl: config.authServiceUrl,
    });

    if (!result.success) {
      log.fail(result.error?.message || `Command '${command}' failed`);
      return 1;
    }

    log.pass(`${command} completed successfully`);
    return 0;
  }

  async cmdDeploy(): Promise<number> {
    return this.runCommand('deploy');
  }

  async cmdMigrate(): Promise<number> {
    return this.runCommand('migrate');
  }

  async cmdSeed(): Promise<number> {
    return this.runCommand('seed');
  }

  async cmdStatus(): Promise<number> {
    return this.runCommand('status');
  }

  async cmdSecrets(): Promise<number> {
    return this.runCommand('secrets');
  }

  async cmdAuth(): Promise<number> {
    return this.runCommand('auth');
  }

  async cmdCluster(): Promise<number> {
    return this.runCommand('cluster');
  }

  async cmdDescribe(): Promise<number> {
    return this.runCommand('describe');
  }

  async cmdLogs(): Promise<number> {
    return this.runCommand('logs');
  }
}

DbDeployCommand.main();
