/**
 * AWS S3 utilities.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import { aws } from '../../shell/index.js';
import { log } from '../../../framework/logging/index.js';
import { validateResourceName } from '../../../framework/utils/validation.js';
import { safeParseJson, S3BucketsSchema, S3EncryptionSchema } from '../../types.js';
import type { S3BucketInfo } from '../../types.js';
import { awsGetRegion } from './core.js';

export function s3BucketExists(bucketName: string): boolean {
  bucketName = validateResourceName(bucketName, 'S3 bucket');
  try {
    aws(`s3api head-bucket --bucket ${bucketName}`, { silent: true });
    return true;
  } catch {
    return false;
  }
}

export function s3ListBuckets(): { Buckets: Array<{ Name?: string; CreationDate?: string }> } {
  try {
    const result = aws('s3api list-buckets --output json', { silent: true });
    const parsed = safeParseJson(result, S3BucketsSchema);
    return { Buckets: parsed?.Buckets ?? [] };
  } catch (e: unknown) {
    log.debug(`s3ListBuckets failed: ${(e as Error).message || String(e)}`);
    return { Buckets: [] };
  }
}

export function s3CreateBucket(bucketName: string, region?: string): boolean {
  bucketName = validateResourceName(bucketName, 'S3 bucket');
  const effectiveRegion = region || awsGetRegion();
  try {
    let cmd = `s3api create-bucket --bucket ${bucketName}`;
    if (effectiveRegion !== 'us-east-1') cmd += ` --create-bucket-configuration LocationConstraint=${effectiveRegion}`;
    aws(cmd, { silent: true, region: effectiveRegion });
    log.pass(`S3 bucket created: ${bucketName}`);
    return true;
  } catch (e: unknown) {
    log.fail(`s3CreateBucket failed for ${bucketName}: ${(e as Error).message || String(e)}`);
    return false;
  }
}

export function s3BlockPublicAccess(bucketName: string): boolean {
  bucketName = validateResourceName(bucketName, 'S3 bucket');
  try {
    aws(`s3api put-public-access-block --bucket ${bucketName} --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true`, { silent: true });
    return true;
  } catch {
    return false;
  }
}

export function s3EnableVersioning(bucketName: string): boolean {
  bucketName = validateResourceName(bucketName, 'S3 bucket');
  try {
    aws(`s3api put-bucket-versioning --bucket ${bucketName} --versioning-configuration Status=Enabled`, { silent: true });
    return true;
  } catch {
    return false;
  }
}

export function s3GetBucketInfo(bucketName: string): S3BucketInfo {
  bucketName = validateResourceName(bucketName, 'S3 bucket');
  const info: S3BucketInfo = { name: bucketName };
  try {
    const loc = aws(`s3api get-bucket-location --bucket ${bucketName} --output text`, { silent: true });
    info.region = loc === 'None' ? 'us-east-1' : loc;
  } catch (e: unknown) {
    log.debug(`s3GetBucketInfo region failed: ${(e as Error).message || String(e)}`);
    info.region = 'Unknown';
  }
  try {
    info.versioning = aws(`s3api get-bucket-versioning --bucket ${bucketName} --query 'Status' --output text`, { silent: true }) || 'Disabled';
  } catch (e: unknown) {
    log.debug(`s3GetBucketInfo versioning failed: ${(e as Error).message || String(e)}`);
    info.versioning = 'Disabled';
  }
  try {
    const enc = aws(`s3api get-bucket-encryption --bucket ${bucketName} --output json`, { silent: true, ignoreError: true });
    if (enc) {
      const parsed = safeParseJson(enc, S3EncryptionSchema);
      info.encryption = parsed?.ServerSideEncryptionConfiguration?.Rules?.[0]?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm || 'None';
    } else {
      info.encryption = 'None';
    }
  } catch (e: unknown) {
    log.debug(`s3GetBucketInfo encryption failed: ${(e as Error).message || String(e)}`);
    info.encryption = 'None';
  }
  return info;
}

export function s3ListObjects(bucketName: string, prefix = '', limit = 20): string[] {
  bucketName = validateResourceName(bucketName, 'S3 bucket');
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`Invalid limit: "${limit}". Must be a positive integer.`);
  }
  try {
    const result = aws(`s3 ls s3://${bucketName}/${prefix} --recursive`, { silent: true });
    return result.split('\n').filter((line) => line.trim()).slice(0, limit);
  } catch (e: unknown) {
    log.debug(`s3ListObjects failed for ${bucketName}/${prefix}: ${(e as Error).message || String(e)}`);
    return [];
  }
}

export function s3UploadString(bucketName: string, key: string, content: string, contentType = 'text/plain'): boolean {
  bucketName = validateResourceName(bucketName, 'S3 bucket');
  key = validateResourceName(key, 'S3 key');
  if (content === undefined || content === null) {
    throw new Error('Content is required for S3 upload');
  }

  // Secure temporary file with random ID
  const randomId = crypto.randomBytes(8).toString('hex');
  const tmpFile = path.join(os.tmpdir(), `s3-upload-${randomId}.tmp`);

  try {
    // Write with restricted permissions
    fs.writeFileSync(tmpFile, content, { mode: 0o600 });
    aws(`s3 cp ${tmpFile} s3://${bucketName}/${key} --content-type "${contentType}"`, { silent: true });
    log.debug(`s3UploadString succeeded: ${bucketName}/${key}`);
    return true;
  } catch (e: unknown) {
    log.fail(`s3UploadString failed for ${bucketName}/${key}: ${(e as Error).message || String(e)}`);
    return false;
  } finally {
    // Ensure cleanup with error logging
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch (cleanupError) {
      log.debug(`Failed to cleanup temp file ${tmpFile}: ${(cleanupError as Error).message || String(cleanupError)}`);
    }
  }
}
