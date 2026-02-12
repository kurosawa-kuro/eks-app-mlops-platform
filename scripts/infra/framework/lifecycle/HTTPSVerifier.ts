/**
 * HTTPSVerifier - verifies HTTPS endpoints.
 */

import { run, sleep } from '../../infrastructure/shell/index.js';
import { log } from '../logging/logger.js';
import { c } from '../logging/colors.js';

export class HTTPSVerifier {
  apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async verify(maxRetries = 5, intervalSec = 10): Promise<boolean> {
    if (!this.apiUrl) {
      log.warn('API URL not configured, skipping HTTPS verification');
      return true;
    }
    const healthUrl = `${this.apiUrl}/health`;
    log.info(`Testing HTTPS endpoint: ${healthUrl}`);
    log.info(`Retrying up to ${maxRetries} times with ${intervalSec}s intervals...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = run(`curl -sf --connect-timeout 10 --max-time 15 "${healthUrl}"`);
        try {
          log.pass('HTTPS health check passed');
          console.log(c.dim(`  Response: ${JSON.stringify(JSON.parse(result))}`));
        } catch {
          log.pass('HTTPS endpoint responded');
          console.log(c.dim(`  Response: ${result.substring(0, 100)}`));
        }
        return true;
      } catch {
        const remaining = maxRetries - attempt;
        if (remaining > 0) {
          console.log(c.dim(`  [${attempt}/${maxRetries}] Waiting for endpoint... (${remaining} retries left)`));
          await sleep(intervalSec * 1000);
        } else {
          log.fail(`HTTPS verification failed after ${maxRetries} attempts`);
          log.info(`Manual check: curl -v ${healthUrl}`);
          return false;
        }
      }
    }
    return false;
  }
}
