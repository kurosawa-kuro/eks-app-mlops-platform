/**
 * K8s Adapters Export - Minimal Mode
 */

export { K8sAdapter } from './kubernetes.adapter.js'
export { K8sSsmAdapter } from './kubernetes-ssm.adapter.js'
export type { K8sSsmAdapterConfig } from './kubernetes-ssm.adapter.js'
export * from './types.js'

/* COMMENTED OUT FOR MINIMAL MODE
export { PrometheusAdapter } from './prometheus.adapter.js'
*/
