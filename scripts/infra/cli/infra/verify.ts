#!/usr/bin/env npx tsx
/**
 * Verify CLI
 *
 * Infrastructure endpoint verification.
 *
 * Usage:
 *   npx tsx verify.ts ingress   # Verify ingress endpoints (DNS/SSL/HTTP)
 *   npx tsx verify.ts health    # Verify API health endpoint
 */

import { InfraCommand, lib } from '../../framework/command/InfraCommand.js';
import type { ContextConfig } from '../../framework/narrative/types.js';

const { log, c, run } = lib;

// Configuration
const ENDPOINTS = {
  apiHealth: 'https://api.tk-k8s.com/health',
  appRoot: 'https://app.tk-k8s.com',
};

interface VerifyResult {
  endpoint: string;
  success: boolean;
  error?: string;
}

class VerifyCommand extends InfraCommand {
  static override name = 'verify';
  static override description = 'Infrastructure endpoint verification';
  static override commands = {
    ingress: { desc: 'Verify ingress endpoints (DNS/SSL/HTTP)', aliases: [''] },
    health: { desc: 'Verify API health endpoint' },
  };

  /**
   * Verify ingress endpoints
   */
  async cmdIngress(): Promise<number> {
    const context: ContextConfig = {
      title: 'Ingress Verification',
      items: [
        { label: 'API', value: 'api.tk-k8s.com' },
        { label: 'App', value: 'app.tk-k8s.com' },
      ],
    };
    lib.showContext(context);

    log.section('Ingress URL Verification');

    const endpoints = [
      { name: 'api.tk-k8s.com/health', url: ENDPOINTS.apiHealth },
      { name: 'app.tk-k8s.com', url: ENDPOINTS.appRoot },
    ];

    const results: VerifyResult[] = [];

    for (const { name, url } of endpoints) {
      const result = await this.verifyEndpoint(name, url);
      results.push(result);
    }

    // Summary
    console.log('');
    const allSuccess = results.every(r => r.success);

    if (allSuccess) {
      log.pass('All Ingress URLs OK');
      return 0;
    } else {
      const failed = results.filter(r => !r.success);
      log.fail(`${failed.length} endpoint(s) failed`);
      for (const f of failed) {
        console.log(`  ${c.red('✗')} ${f.endpoint}: ${f.error || 'Unknown error'}`);
      }
      return 1;
    }
  }

  /**
   * Verify API health endpoint only
   */
  async cmdHealth(): Promise<number> {
    const context: ContextConfig = {
      title: 'API Health Check',
      items: [
        { label: 'Endpoint', value: ENDPOINTS.apiHealth },
      ],
    };
    lib.showContext(context);

    const verifier = new lib.HTTPSVerifier(ENDPOINTS.apiHealth.replace('/health', ''));
    const success = await verifier.verify(3, 5);

    return success ? 0 : 1;
  }

  /**
   * Verify a single endpoint
   */
  private async verifyEndpoint(name: string, url: string): Promise<VerifyResult> {
    try {
      run(`curl -fsS --max-time 10 "${url}"`, { ignoreError: false });
      console.log(`  ${c.green('✓')} ${name}`);
      return { endpoint: name, success: true };
    } catch (e) {
      console.log(`  ${c.red('✗')} ${name}`);
      return {
        endpoint: name,
        success: false,
        error: (e as Error).message
      };
    }
  }
}

// Entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  VerifyCommand.main();
}
