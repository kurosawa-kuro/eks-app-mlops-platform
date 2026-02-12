import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appConfigSchema, type AppConfig } from './schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..')

/**
 * ConfigMap ファイルパス
 * - ローカル: {project}/env/config.json
 * - K8s: CONFIG_FILE_PATH で指定
 */
const CONFIG_FILE_PATH = process.env.CONFIG_FILE_PATH || join(PROJECT_ROOT, 'env', 'config.json')

function loadConfigFile(): Record<string, unknown> {
  if (!existsSync(CONFIG_FILE_PATH)) {
    return {}
  }
  try {
    return JSON.parse(readFileSync(CONFIG_FILE_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function loadFromEnv(): Record<string, unknown> {
  return {
    // ① 実行モード / 環境制御（最上位）
    appEnv: process.env.APP_ENV,
    appMode: process.env.APP_MODE,

    // ② サーバー / アプリ基本設定
    projectName: process.env.PROJECT_NAME,
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    rateLimitPerMinute: process.env.RATE_LIMIT_PER_MINUTE,

    // ⑤ AWS（Read / 管理系）
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.AWS_REGION,

    // ⑤-3 Kubernetes / Prometheus / Loki
    k8sNamespace: process.env.K8S_NAMESPACE,
    k8sMonitoredNamespaces: process.env.K8S_MONITORED_NAMESPACES,
    k8sBastionInstanceId: process.env.K8S_BASTION_INSTANCE_ID,
    k8sEksClusterName: process.env.K8S_EKS_CLUSTER_NAME,
    prometheusUrl: process.env.PROMETHEUS_URL,
    lokiUrl: process.env.LOKI_URL,
    cacheTtlK8s: process.env.CACHE_TTL_K8S,
    cacheTtlMetrics: process.env.CACHE_TTL_METRICS,

    // ⑨ アラート / 監視
    alertEnabled: process.env.ALERT_ENABLED,
    alertChannel: process.env.ALERT_CHANNEL,
    alertSlackWebhookUrl: process.env.ALERT_SLACK_WEBHOOK_URL,
    alertEmailTo: process.env.ALERT_EMAIL_TO,
  }
}

function merge(...configs: Record<string, unknown>[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const config of configs) {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined && value !== '') {
        result[key] = value
      }
    }
  }
  return result
}

/**
 * 設定読み込み
 * 優先順位: ConfigMapファイル > 環境変数
 */
export function loadConfig(): AppConfig {
  const merged = merge(loadFromEnv(), loadConfigFile())
  const result = appConfigSchema.safeParse(merged)
  if (!result.success) {
    const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
    throw new Error(`Config validation failed: ${errors}`)
  }
  return result.data
}
