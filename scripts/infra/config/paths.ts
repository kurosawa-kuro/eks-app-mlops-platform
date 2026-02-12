/**
 * Path Constants
 *
 * Centralized path definitions for the infrastructure scripts.
 * All paths are resolved relative to this file's location.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Project paths - absolute paths to key directories.
 */
export const PATHS = {
  /** Project root directory */
  root: path.resolve(__dirname, '../../..'),

  /** Scripts/infra directory */
  infra: path.resolve(__dirname, '..'),

  /** Infrastructure definitions */
  infraDefs: path.resolve(__dirname, '../../../infra'),

  /** Kubernetes manifests */
  k8s: path.resolve(__dirname, '../../../infra/k8s'),

  /** Terraform directories */
  terraform: {
    prod: path.resolve(__dirname, '../../../infra/terraform/prod'),
    shared: path.resolve(__dirname, '../../../infra/terraform/shared'),
  },

  /** Application directories */
  apps: {
    backend: path.resolve(__dirname, '../../../apps/app-backend'),
    frontend: path.resolve(__dirname, '../../../apps/app-frontend'),
  },

  /** MLOps directory */
  mlops: path.resolve(__dirname, '../../../mlops'),
} as const;

/**
 * Relative path patterns (for display/logging).
 */
export const RELATIVE_PATHS = {
  terraform: {
    prod: 'infra/terraform/prod',
    shared: 'infra/terraform/shared',
  },
  k8s: {
    base: 'infra/k8s',
    overlays: 'infra/k8s/overlays',
  },
} as const;

/**
 * S3 prefixes for uploaded manifests/artifacts.
 */
export const S3_PREFIXES = {
  app: 'k8s-manifests',
  mlops: 'mlops-manifests',
  analytics: 'analytics',
  models: 'models',
} as const;

/**
 * Get Kubernetes overlay path.
 */
export function getOverlayPath(overlay: 'prod' | 'staging' | 'local'): string {
  return path.join(PATHS.k8s, 'overlays', overlay);
}

/**
 * Get Terraform directory path.
 */
export function getTerraformPath(env: 'prod' | 'shared'): string {
  return PATHS.terraform[env];
}
