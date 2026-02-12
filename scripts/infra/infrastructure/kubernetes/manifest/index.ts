/**
 * Kubernetes Manifest Templates Module
 *
 * Provides utilities for rendering Kubernetes manifests from templates.
 *
 * @example
 * import { renderManifest, joinManifests } from './manifests/index.js';
 *
 * const configMap = renderManifest('configmap', {
 *   name: 'app-config',
 *   namespace: 'default',
 *   data: { API_URL: 'https://api.example.com' }
 * });
 *
 * const namespace = renderManifest('namespace', { name: 'my-app' });
 *
 * const combined = joinManifests(namespace, configMap);
 */

// Template engine exports
export {
  render,
  validateTemplate,
  extractVariables,
  type TemplateContext,
} from './engine.js';

// Renderer exports
export {
  renderManifest,
  renderManifestWithInfo,
  renderInline,
  templateExists,
  getTemplatesDir,
  joinManifests,
  type RenderOptions,
  type RenderResult,
} from './renderer.js';

/**
 * Available template names.
 * Use with renderManifest() function.
 */
export const TEMPLATES = {
  /** ConfigMap template */
  CONFIGMAP: 'configmap',
  /** Namespace template */
  NAMESPACE: 'namespace',
  /** NVIDIA Device Plugin DaemonSet */
  NVIDIA_DEVICE_PLUGIN: 'nvidia-device-plugin',
  /** Karpenter EC2NodeClass */
  KARPENTER_EC2NODECLASS: 'karpenter-ec2nodeclass',
  /** Karpenter NodePool */
  KARPENTER_NODEPOOL: 'karpenter-nodepool',
} as const;

export type TemplateName = typeof TEMPLATES[keyof typeof TEMPLATES];
