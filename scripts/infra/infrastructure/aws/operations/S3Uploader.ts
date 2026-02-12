/**
 * S3Uploader - uploads files to S3.
 */

import { aws } from '../../shell/index.js';
import { log } from '../../../framework/logging/index.js';
import { c } from '../../../framework/logging/colors.js';
import { awsGetRegion } from '../api/core.js';

export class S3Uploader {
  bucket: string;
  prefix: string;
  region: string;

  constructor(bucket: string, prefix: string, region?: string) {
    this.bucket = bucket;
    this.prefix = prefix;
    this.region = region || awsGetRegion();
  }

  upload(sourceDir: string): boolean {
    log.info(`Uploading to s3://${this.bucket}/${this.prefix}/`);
    try {
      const output = aws(`s3 sync ${sourceDir} s3://${this.bucket}/${this.prefix}/ --delete`, { region: this.region });
      if (output) console.log(c.dim(output));
      log.pass('Manifests uploaded successfully');
      return true;
    } catch (e: unknown) {
      const error = e as Error;
      log.fail(`Upload failed: ${error.message}`);
      return false;
    }
  }

  listFiles(limit = 15): void {
    log.info('Uploaded files:');
    try {
      const files = aws(`s3 ls s3://${this.bucket}/${this.prefix}/ --recursive`, { region: this.region });
      console.log(c.dim(files.split('\n').slice(0, limit).join('\n')));
    } catch {
      // Ignore errors
    }
  }
}
