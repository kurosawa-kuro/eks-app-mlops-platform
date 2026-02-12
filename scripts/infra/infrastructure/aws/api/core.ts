/**
 * AWS core utilities.
 */

import { run } from '../../shell/index.js';

/**
 * Get AWS region from environment or default.
 */
export function awsGetRegion(): string {
  return process.env.AWS_REGION || 'ap-northeast-1';
}

/**
 * [Uses BOUNDARY: AWS CLI]
 * Get current AWS account ID via STS.
 */
export function awsGetAccountId(): string | null {
  try {
    return run('aws sts get-caller-identity --query Account --output text', { silent: true });
  } catch {
    return null;
  }
}
