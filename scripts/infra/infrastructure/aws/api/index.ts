/**
 * AWS API - stateless query functions (describe, list, get)
 */

// Core utilities
export { awsGetRegion, awsGetAccountId } from './core.js';

// ECR
export {
  ecrGetRegistryUrl,
  ecrDockerLogin,
  ecrListRepositories,
  ecrRepositoryExists,
  ecrCreateRepository,
  ecrListImages,
  ecrSetLifecyclePolicy,
} from './ecr.js';

// EKS
export {
  eksUpdateKubeconfig,
  eksGetClusterInfo,
  eksGetClusterStatus,
  eksGetClusterVersion,
  eksListNodeGroups,
  eksDescribeNodeGroup,
} from './eks.js';

// S3
export {
  s3BucketExists,
  s3ListBuckets,
  s3CreateBucket,
  s3BlockPublicAccess,
  s3EnableVersioning,
  s3GetBucketInfo,
  s3ListObjects,
  s3UploadString,
} from './s3.js';

// Secrets Manager
export {
  secretsList,
  secretsExists,
  secretsDescribe,
  secretsGetValue,
  secretsCreate,
  secretsUpdate,
  secretsDelete,
} from './secrets.js';
