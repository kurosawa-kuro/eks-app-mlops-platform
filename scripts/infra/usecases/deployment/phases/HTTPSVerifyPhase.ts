/**
 * HTTPSVerifyPhase - verifies HTTPS endpoint availability.
 */

import { HTTPSVerifier } from '../../../framework/lifecycle/HTTPSVerifier.js';
import type {
  ExecutableDeploymentPhase,
  DeploymentPhaseContext,
  DeploymentPhaseResult,
  HTTPSVerifyResult,
} from './types.js';

/** Options for HTTPS verification */
export interface HTTPSVerifyOptions {
  /** URL to verify */
  url: string;
  /** Skip verification */
  skip?: boolean;
}

/**
 * Phase that verifies HTTPS endpoint availability.
 *
 * @example
 * const phase = new HTTPSVerifyPhase({
 *   url: 'https://api.example.com',
 * });
 * const result = await phase.execute(context);
 */
export class HTTPSVerifyPhase implements ExecutableDeploymentPhase<HTTPSVerifyResult> {
  readonly name = 'HTTPS Verify';
  readonly description = 'Verify HTTPS endpoint availability';

  private options: HTTPSVerifyOptions;

  constructor(options: HTTPSVerifyOptions) {
    this.options = options;
  }

  async execute(context: DeploymentPhaseContext): Promise<DeploymentPhaseResult<HTTPSVerifyResult>> {
    const { log } = context;
    const { url, skip } = this.options;

    // Skip if requested or no URL
    if (skip || !url) {
      return {
        success: true,
        data: { passed: false, url: url || '' },
        skipped: true,
        skipReason: skip ? 'HTTPS verification skipped by user' : 'No URL provided',
      };
    }

    try {
      const verifier = new HTTPSVerifier(url);
      const passed = await verifier.verify();

      if (passed) {
        log.pass(`HTTPS endpoint verified: ${url}`);
        return {
          success: true,
          data: {
            passed: true,
            url,
            statusCode: 200,
          },
        };
      } else {
        log.warn('HTTPS verification failed - deployment may still be successful');
        return {
          success: true, // Don't fail the whole deployment for HTTPS verification
          data: {
            passed: false,
            url,
          },
        };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log.warn(`HTTPS verification error: ${error}`);
      return {
        success: true, // Don't fail the whole deployment
        data: {
          passed: false,
          url,
        },
      };
    }
  }
}
