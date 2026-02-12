/**
 * AWS Smoke Test
 *
 * Verifies AWS CLI connectivity and credentials.
 */

import { awsGetAccountId, awsGetRegion } from '../infrastructure/aws/index.js';
import { createSmoke, ok, fail } from './helpers.js';

export const awsSmoke = createSmoke('aws', () => {
  const accountId = awsGetAccountId();
  if (!accountId) {
    return fail('AWS credentials not configured or expired');
  }

  const region = awsGetRegion();
  return ok(`Account ${accountId}, Region ${region}`, { accountId, region });
});
