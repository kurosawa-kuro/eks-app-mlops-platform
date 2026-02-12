/**
 * AWS Secrets Manager utilities.
 */

import { aws } from '../../shell/index.js';
import { log } from '../../../framework/logging/index.js';
import { validateResourceName } from '../../../framework/utils/validation.js';
import {
  safeParseJson,
  SecretsListSchema,
  SecretsDescribeSchema,
  SecretsCreateSchema,
} from '../../types.js';
import type { SecretInfo, SecretsListItemResponse } from '../../types.js';

export function secretsList(region?: string): SecretsListItemResponse[] {
  try {
    const result = aws(
      `secretsmanager list-secrets --query 'SecretList[*].{Name:Name,Description:Description,Modified:LastChangedDate}' --output json`,
      { silent: true, region }
    );
    return safeParseJson(result, SecretsListSchema) ?? [];
  } catch (e: unknown) {
    log.debug(`secretsList failed: ${(e as Error).message || String(e)}`);
    return [];
  }
}

export function secretsExists(secretName: string, region?: string): boolean {
  secretName = validateResourceName(secretName, 'secret');
  try {
    aws(`secretsmanager describe-secret --secret-id ${secretName}`, { silent: true, region });
    return true;
  } catch {
    return false;
  }
}

export function secretsDescribe(secretName: string, region?: string): SecretInfo | null {
  secretName = validateResourceName(secretName, 'secret');
  try {
    const result = aws(`secretsmanager describe-secret --secret-id ${secretName} --output json`, { silent: true, region });
    const parsed = safeParseJson(result, SecretsDescribeSchema);
    if (!parsed?.Name) return null;
    return parsed as SecretInfo;
  } catch (e: unknown) {
    log.debug(`secretsDescribe failed for ${secretName}: ${(e as Error).message || String(e)}`);
    return null;
  }
}

export function secretsGetValue(secretName: string, region?: string): string | null {
  secretName = validateResourceName(secretName, 'secret');
  try {
    return aws(`secretsmanager get-secret-value --secret-id ${secretName} --query 'SecretString' --output text`, { silent: true, region });
  } catch (e: unknown) {
    log.debug(`secretsGetValue failed for ${secretName}: ${(e as Error).message || String(e)}`);
    return null;
  }
}

export function secretsCreate(secretName: string, secretValue: string, region?: string, description = ''): { ARN?: string; Name?: string } {
  secretName = validateResourceName(secretName, 'secret');
  let cmd = `secretsmanager create-secret --name ${secretName}`;
  if (description) cmd += ` --description '${description}'`;
  cmd += ` --secret-string '${secretValue.replace(/'/g, "'\\''")}'`;
  const result = aws(cmd, { silent: true, region });
  return safeParseJson(result, SecretsCreateSchema) ?? {};
}

export function secretsUpdate(secretName: string, secretValue: string, region?: string): boolean {
  secretName = validateResourceName(secretName, 'secret');
  try {
    aws(`secretsmanager put-secret-value --secret-id ${secretName} --secret-string '${secretValue.replace(/'/g, "'\\''")}'`, { silent: true, region });
    return true;
  } catch (e: unknown) {
    log.debug(`secretsUpdate failed for ${secretName}: ${(e as Error).message || String(e)}`);
    return false;
  }
}

export function secretsDelete(secretName: string, region?: string, forceDelete = false): boolean {
  secretName = validateResourceName(secretName, 'secret');
  try {
    let cmd = `secretsmanager delete-secret --secret-id ${secretName}`;
    if (forceDelete) cmd += ' --force-delete-without-recovery';
    aws(cmd, { silent: true, region });
    return true;
  } catch (e: unknown) {
    log.debug(`secretsDelete failed for ${secretName}: ${(e as Error).message || String(e)}`);
    return false;
  }
}
