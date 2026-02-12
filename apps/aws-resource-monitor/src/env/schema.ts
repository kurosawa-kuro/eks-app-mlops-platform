import { z } from 'zod'

// 環境変数の文字列 "true"/"false" を正しくブール値に変換
const envBoolean = z.preprocess((val) => {
  if (typeof val === 'string') {
    return val.toLowerCase() === 'true'
  }
  return Boolean(val)
}, z.boolean())

export const appConfigSchema = z.object({
  // ① 実行モード / 環境制御（最上位）
  appEnv: z.enum(['local', 'development', 'production']).default('local'),
  appMode: z.enum(['origin', 'stable']).default('origin'),

  // ② サーバー / アプリ基本設定
  projectName: z.string().default('aws-resource-monitor'),
  port: z.coerce.number().default(8001),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  rateLimitPerMinute: z.coerce.number().default(100),

  // ⑤ AWS（Read / 管理系）
  awsAccessKeyId: z.string().default(''),
  awsSecretAccessKey: z.string().default(''),
  awsRegion: z.string().default('ap-northeast-1'),

  // ⑤-2 AWS Resource Monitor キャッシュ設定
  cacheTtlResources: z.coerce.number().default(300000), // 5分
  cacheTtlCosts: z.coerce.number().default(3600000),    // 1時間

  // ⑤-3 Kubernetes (Minimal Mode) - 常に有効、フラグ不要
  k8sNamespace: z.string().default(''),  // 空 = 全namespace (legacy)
  k8sMonitoredNamespaces: z.string().default('database,app,monitoring,karpenter,llm'),  // Minimal Mode: 監視対象namespace
  k8sBastionInstanceId: z.string().default(''),  // SSM経由でK8sにアクセスする場合のBastionインスタンスID
  k8sEksClusterName: z.string().default(''),     // EKSクラスター名
  prometheusUrl: z.string().default('http://prometheus.monitoring.svc.cluster.local:9090'),
  lokiUrl: z.string().default('http://loki.monitoring.svc.cluster.local:3100'),
  cacheTtlK8s: z.coerce.number().default(60000),      // 1分
  cacheTtlMetrics: z.coerce.number().default(30000),  // 30秒

  // ⑨ アラート / 監視
  alertEnabled: envBoolean.default(false),
  alertChannel: z.enum(['slack', 'email']).default('slack'),
  alertSlackWebhookUrl: z.string().default(''),
  alertEmailTo: z.string().default(''),
})

export type AppConfig = z.infer<typeof appConfigSchema>
