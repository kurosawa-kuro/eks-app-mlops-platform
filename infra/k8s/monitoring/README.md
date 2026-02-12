# Monitoring Stack

Prometheus + Grafana + Loki + Alertmanager による監視スタック。

## コンポーネント

| コンポーネント | 役割 | ポート |
|---------------|------|--------|
| Prometheus | メトリクス収集・保存 | 9090 |
| Alertmanager | アラート管理・通知 | 9093 |
| Grafana | ダッシュボード・可視化 | 3000 |
| Loki | ログ集約 | 3100 |
| Promtail | ログ収集 (DaemonSet) | - |
| kube-state-metrics | K8s メトリクス | 8080 |

## ディレクトリ構成

```
monitoring/
├── base/
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── prometheus/
│   │   ├── serviceaccount.yaml
│   │   ├── configmap.yaml          # スクレイプ設定
│   │   ├── configmap-rules.yaml    # アラート・Recording Rules
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── alertmanager/
│   │   ├── configmap.yaml          # 通知設定
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── grafana/
│   │   ├── secrets.yaml            # admin パスワード
│   │   ├── configmap-datasources.yaml
│   │   ├── configmap-dashboards.yaml
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── loki/
│   │   ├── configmap.yaml
│   │   ├── statefulset.yaml
│   │   └── service.yaml
│   └── promtail/
│       ├── serviceaccount.yaml
│       ├── configmap.yaml
│       └── daemonset.yaml
└── overlays/
    └── local/
        └── kustomization.yaml      # リソース制限 (Kind 用)
```

## デプロイ

```bash
# Kind (ローカル)
kubectl apply -k infra/k8s/monitoring/overlays/local

# kube-state-metrics (別途必要)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/v2.10.1/examples/standard/cluster-role.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/v2.10.1/examples/standard/cluster-role-binding.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/v2.10.1/examples/standard/service-account.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/v2.10.1/examples/standard/deployment.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/v2.10.1/examples/standard/service.yaml
```

## アクセス

```bash
# Grafana
kubectl port-forward svc/grafana -n monitoring 3001:3000
# http://localhost:3001 (admin / see grafana secret)

# Prometheus
kubectl port-forward svc/prometheus -n monitoring 9090:9090
# http://localhost:9090

# Alertmanager
kubectl port-forward svc/alertmanager -n monitoring 9093:9093
# http://localhost:9093
```

## Grafana ダッシュボード

| ダッシュボード | 内容 |
|---------------|------|
| Cluster Overview | クラスタ全体の CPU/Memory、Pod 数、namespace 別リソース |
| Namespace Overview | namespace 変数でフィルタ、Pod 別 CPU/Memory、Pod Status |
| App Backend Metrics | HTTP リクエスト数、エラー数、メモリ使用量、リクエストレート |

## アラートルール

| ルール | 説明 | 重要度 |
|-------|------|--------|
| PodCrashLoopBackOff | Pod 再起動ループ (15分で3回以上) | critical |
| PodNotReady | Pod が10分以上 Pending/Unknown | warning |
| ContainerOOMKilled | コンテナがメモリ不足で強制終了 | warning |
| HighCPUUsage | CPU 使用率 80% 超 (10分継続) | warning |
| HighMemoryUsage | メモリ使用率 80% 超 (10分継続) | warning |
| HighErrorRate | HTTP エラー率 5% 超 | critical |
| AppBackendDown | app-backend が2分以上ダウン | critical |

## Recording Rules

事前計算されたメトリクス (クエリ高速化):

```promql
# HTTP
http_requests:rate5m        # リクエストレート
http_errors:rate5m          # エラーレート
http_error_rate:ratio5m     # エラー率

# Pod CPU
pod:cpu:usage_rate5m        # Pod CPU 使用率
pod:cpu:usage_percent       # Pod CPU 使用率 (%)
namespace:cpu:usage_rate5m  # Namespace CPU 使用率

# Pod Memory
pod:memory:usage_bytes      # Pod メモリ使用量
pod:memory:usage_percent    # Pod メモリ使用率 (%)
namespace:memory:usage_bytes # Namespace メモリ使用量

# App Backend
app_backend:uptime_seconds      # アプリ稼働時間
app_backend:heap_used_bytes     # ヒープ使用量
app_backend:requests_per_second # リクエスト/秒
```

## スクレイプターゲット

| ターゲット | エンドポイント |
|-----------|---------------|
| app-backend | app-backend-service:8000/metrics |
| prometheus | localhost:9090/metrics |
| kube-state-metrics | kube-state-metrics.kube-system:8080/metrics |
| kubernetes-apiservers | kubernetes.default:443/metrics |
| kubernetes-nodes | nodes/proxy/metrics |
| kubernetes-pods | prometheus.io/scrape=true のアノテーション付き Pod |

## 確認コマンド

```bash
# Pod 状態
kubectl get pods -n monitoring

# Prometheus ターゲット
kubectl exec -n monitoring deployment/prometheus -- \
  wget -qO- http://localhost:9090/api/v1/targets | jq '.data.activeTargets[].health'

# アラート状態
kubectl exec -n monitoring deployment/prometheus -- \
  wget -qO- http://localhost:9090/api/v1/alerts

# Recording Rules
kubectl exec -n monitoring deployment/prometheus -- \
  wget -qO- "http://localhost:9090/api/v1/query?query=http_requests:rate5m"
```

## ArgoCD 連携

```yaml
# infra/k8s/argocd/monitoring-appset.yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: monitoring-stack
spec:
  generators:
    - list:
        elements:
          - env: local
  template:
    spec:
      source:
        path: 'infra/k8s/monitoring/overlays/{{env}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

## 本番環境への拡張

1. **Alertmanager 通知設定**: Slack/PagerDuty 連携
2. **永続化**: Prometheus/Loki に PersistentVolume
3. **リソース増強**: overlays/prod で CPU/Memory 増加
4. **Ingress**: Grafana 外部公開 (HTTPS)
