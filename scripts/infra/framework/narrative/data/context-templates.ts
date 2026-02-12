/**
 * =============================================================================
 * Context Templates - コマンド別コンテキスト定義
 * =============================================================================
 *
 * 各コマンドの「起（Context）」表示内容を定義。
 * 変数プレースホルダ: {{variableName}}
 *
 * =============================================================================
 */

import type { CommandId, ContextConfig } from '../types.js';

/**
 * テンプレート定義型
 */
export type ContextTemplate = Partial<ContextConfig> & { title: string };

/**
 * コマンド別コンテキストテンプレート
 */
export const CONTEXT_TEMPLATES: Record<CommandId, ContextTemplate> = {
  // ============================================================
  // Terraform
  // ============================================================
  'eks-deploy': {
    title: 'EKS Infrastructure Deploy',
    items: [
      { label: 'Region', value: '{{region}}' },
      { label: 'Cluster', value: '{{clusterName}}' },
      { label: 'Mode', value: '{{mode}}' },
    ],
    estimate: {
      totalSeconds: 16 * 60,
      breakdown: [
        { label: 'EKS Cluster', seconds: 10 * 60 },
        { label: 'Node Group', seconds: 5 * 60 },
        { label: 'Bastion', seconds: 1 * 60 },
      ],
    },
  },

  // ============================================================
  // Kubernetes
  // ============================================================
  'k8s-deploy': {
    title: 'Kubernetes App Deploy',
    items: [
      { label: 'Cluster', value: '{{clusterName}}' },
      { label: 'Overlay', value: '{{overlay}}' },
      { label: 'Component', value: '{{component}}' },
    ],
  },

  'k8s-deploy-mlops': {
    title: 'Kubernetes MLOps Deploy',
    items: [
      { label: 'Cluster', value: '{{clusterName}}' },
      { label: 'Namespace', value: 'mlops' },
    ],
  },

  'k8s-deploy-gpu': {
    title: 'Kubernetes GPU/LLM Deploy',
    items: [
      { label: 'Cluster', value: '{{clusterName}}' },
      { label: 'Step', value: '{{step}}' },
    ],
  },

  'k8s-init': {
    title: 'Kubernetes Initialization',
    items: [
      { label: 'Cluster', value: '{{clusterName}}' },
      { label: 'Namespaces', value: 'app, mlops' },
    ],
  },

  // ============================================================
  // Database
  // ============================================================
  'db-deploy': {
    title: 'Database Deploy (CNPG)',
    items: [
      { label: 'Cluster', value: '{{clusterName}}' },
      { label: 'Overlay', value: '{{overlay}}' },
      { label: 'CNPG Version', value: '{{cnpgVersion}}' },
    ],
  },

  'db-migrate': {
    title: 'Database Migration',
    items: [
      { label: 'Cluster', value: '{{clusterName}}' },
      { label: 'Target', value: 'app-backend' },
    ],
  },

  'db-seed': {
    title: 'Database Seed',
    items: [
      { label: 'Cluster', value: '{{clusterName}}' },
      { label: 'Target', value: 'app-backend' },
    ],
  },

  'secrets-create': {
    title: 'Create App Secrets',
    items: [
      { label: 'Cluster', value: '{{clusterName}}' },
      { label: 'Namespace', value: 'app' },
      { label: 'Secret', value: 'app-backend-secrets' },
    ],
  },

  'auth-setup': {
    title: 'Auth Service Setup',
    items: [
      { label: 'Cluster', value: '{{clusterName}}' },
      { label: 'AUTH_SERVICE_URL', value: '{{authServiceUrl}}' },
    ],
  },

  // ============================================================
  // Bastion
  // ============================================================
  'bastion-connect': {
    title: 'Bastion SSH Connect',
    items: [
      { label: 'Instance', value: '{{bastionId}}' },
      { label: 'Region', value: '{{region}}' },
    ],
  },

  'bastion-status': {
    title: 'Bastion Status Check',
    items: [
      { label: 'Instance', value: '{{bastionId}}' },
      { label: 'Region', value: '{{region}}' },
    ],
  },

  'bastion-setup': {
    title: 'Bastion Setup',
    items: [
      { label: 'Instance', value: '{{bastionId}}' },
      { label: 'Tools', value: 'kubectl, helm' },
    ],
  },

  // ============================================================
  // MLOps
  // ============================================================
  'mlops-deploy': {
    title: 'MLOps Deploy',
    items: [
      { label: 'S3 Bucket', value: '{{s3Bucket}}' },
      { label: 'IRSA Role', value: '{{roleArn}}' },
    ],
  },

  'mlops-build': {
    title: 'MLOps Docker Build',
    items: [
      { label: 'Image', value: '{{imageName}}' },
      { label: 'Tag', value: '{{tag}}' },
    ],
  },

  'mlops-push': {
    title: 'MLOps Push to ECR',
    items: [
      { label: 'Registry', value: '{{registry}}' },
      { label: 'Image', value: '{{imageName}}' },
    ],
  },

  'mlops-job': {
    title: 'MLOps Job Execute',
    items: [
      { label: 'Job', value: '{{jobName}}' },
      { label: 'Namespace', value: 'mlops' },
    ],
  },

  // ============================================================
  // Smoke Test
  // ============================================================
  'smoke-test': {
    title: 'Smoke Test',
    items: [
      { label: 'Mode', value: '{{mode}}' },
      { label: 'Skip App', value: '{{skipApp}}' },
    ],
  },
};
