/**
 * ManifestUploadPhase - uploads K8s manifests to S3.
 */

import { S3Uploader } from '../../../infrastructure/aws/operations/S3Uploader.js';
import { aws } from '../../../infrastructure/shell/exec.js';
import type {
  ExecutableDeploymentPhase,
  DeploymentPhaseContext,
  DeploymentPhaseResult,
  ManifestUploadResult,
} from './types.js';

/** Options for manifest upload */
export interface ManifestUploadOptions {
  /** Local directory containing manifests */
  sourceDir: string;
  /** S3 prefix for upload */
  s3Prefix: string;
  /** Additional files to upload */
  additionalFiles?: { localPath: string; s3Key: string }[];
  /** Skip upload (return success without uploading) */
  skip?: boolean;
}

/**
 * Phase that uploads K8s manifests to S3.
 *
 * @example
 * const phase = new ManifestUploadPhase({
 *   sourceDir: '/path/to/k8s',
 *   s3Prefix: 'k8s-manifests',
 * });
 * const result = await phase.execute(context);
 */
export class ManifestUploadPhase implements ExecutableDeploymentPhase<ManifestUploadResult> {
  readonly name = 'Upload Manifests';
  readonly description = 'Upload K8s manifests to S3';

  private options: ManifestUploadOptions;

  constructor(options: ManifestUploadOptions) {
    this.options = options;
  }

  async execute(context: DeploymentPhaseContext): Promise<DeploymentPhaseResult<ManifestUploadResult>> {
    const { bucket, region, log } = context;
    const { sourceDir, s3Prefix, additionalFiles, skip } = this.options;

    // Skip if requested
    if (skip) {
      log.warn('Skipping S3 upload');
      return {
        success: true,
        data: { uploadedCount: 0, s3Prefix },
        skipped: true,
        skipReason: 'Upload skipped by user',
      };
    }

    try {
      // Upload main directory
      const uploader = new S3Uploader(bucket, s3Prefix, region);
      const success = uploader.upload(sourceDir);

      if (!success) {
        log.fail('Manifest upload failed');
        return {
          success: false,
          error: 'Failed to upload manifests to S3',
        };
      }

      // Upload additional files if specified
      if (additionalFiles && additionalFiles.length > 0) {
        for (const file of additionalFiles) {
          aws(`s3 cp ${file.localPath} s3://${bucket}/${s3Prefix}/${file.s3Key}`);
        }
      }

      log.pass('Manifests uploaded to S3');
      return {
        success: true,
        data: {
          uploadedCount: 1,
          s3Prefix,
        },
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log.fail(`Manifest upload failed: ${error}`);
      return {
        success: false,
        error,
      };
    }
  }
}
