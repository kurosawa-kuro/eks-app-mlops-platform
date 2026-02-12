#!/usr/bin/env npx tsx
/**
 * EKS Verification CLI
 *
 * Thin CLI wrapper for verifying EKS deployment.
 *
 * Usage:
 *   npx tsx verify.ts [all]      # Run all verifications
 *   npx tsx verify.ts health     # Health check only
 *   npx tsx verify.ts login      # Login test only
 */

import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import { createInfraContainer } from '../../container/index.js';
import { VerifyDeployment, type VerifyCommand as VerifyCommandType } from '../../usecases/deployment/VerifyDeployment.js';

const { log, c } = lib;

/**
 * Verification Command
 */
class VerifyCLI extends InfraCommand {
  static name = 'verify';
  static description = 'Verify EKS deployment';
  static commands = {
    all: { desc: 'Run all verifications' },
    health: { desc: 'API and Frontend health checks' },
    login: { desc: 'Login verification test' },
    help: { desc: 'Show help' },
  };

  private getConfig() {
    return {
      apiUrl: process.env.API_URL || 'https://api.example.com',
      appUrl: process.env.APP_URL || 'https://app.example.com',
      testUser: {
        email: process.env.TEST_USER_EMAIL || 'admin@example.com',
        password: process.env.TEST_USER_PASSWORD || 'CHANGE_ME',
      },
      timeout: 10000,
    };
  }

  private async runVerification(command: VerifyCommandType): Promise<number> {
    const config = this.getConfig();

    console.log(c.bold('\n=== EKS Verification ===\n'));
    log.info(`API URL: ${config.apiUrl}`);
    log.info(`App URL: ${config.appUrl}`);
    console.log('');

    const container = createInfraContainer(process.cwd());
    const useCase = new VerifyDeployment(container);

    const result = await useCase.execute({
      command: command as 'all' | 'health' | 'login',
      apiUrl: config.apiUrl,
      appUrl: config.appUrl,
      testUser: config.testUser,
      timeout: config.timeout,
    });

    if (!result.success) {
      log.fail(result.error?.message || 'Verification failed');
      return 1;
    }

    const data = result.data!;

    // Summary
    console.log('');
    if (data.allPassed) {
      log.pass('All verifications passed');
      return 0;
    } else {
      log.fail('Some verifications failed');
      return 1;
    }
  }

  async cmdAll(): Promise<number> {
    return this.runVerification('all');
  }

  async cmdHealth(): Promise<number> {
    return this.runVerification('health');
  }

  async cmdLogin(): Promise<number> {
    return this.runVerification('login');
  }
}

VerifyCLI.main();
