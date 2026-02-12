# Kubernetes Manifests

EKS-App-MLOps-Platform の Kubernetes マニフェスト管理ディレクトリ。

## ディレクトリ構成

```
infra/k8s/
├── apps/              # アプリケーション (GitOps対象)
│   ├── base/          # 共通定義
│   └── overlays/      # 環境別パッチ
│       ├── local/     # Kind ローカル
│       ├── staging/
│       └── prod/
│
├── cnpg/              # CloudNativePG (GitOps対象・別App)
│   ├── base/          # Operator, Cluster
│   └── overlays/
│       ├── local/
│       └── prod/
│
├── monitoring/        # 監視スタック (GitOps対象)
│   ├── base/
│   │   ├── prometheus/
│   │   ├── alertmanager/
│   │   ├── grafana/
│   │   ├── loki/
│   │   ├── promtail/
│   │   └── node-exporter/
│   └── overlays/
│       └── local/
│
├── argocd/            # Argo CD ApplicationSet
│   ├── ecshop-appset.yaml
│   ├── cnpg-appset.yaml
│   └── monitoring-appset.yaml
│
├── karpenter/         # Karpenter GPU NodePool (本番EKS用)
│   ├── gpu-nodepool.yaml
│   ├── gpu-ec2nodeclass.yaml
│   └── nvidia-device-plugin.yaml
│
├── llm/               # LLM 推論サービス (オプション)
│   ├── llm-inference-deployment.yaml
│   └── llm-embeddings-deployment.yaml
│
├── kind/              # Kind クラスタ設定 (GitOps対象外)
│   ├── cluster-config.yaml
│   └── README.md
│
└── OLD/               # 旧マニフェスト (GitOps対象外)
    └── monolith/
```

---

## 運用情報 (Kind ローカル)

### アクセス URL

| サービス | URL | 備考 |
|---------|-----|------|
| Backend API | http://localhost:8000 | NodePort |
| Frontend | http://localhost:3000 | port-forward |
| Grafana | http://localhost:3001 | port-forward |
| Prometheus | http://localhost:9090 | port-forward |
| Alertmanager | http://localhost:9093 | port-forward |
| Argo CD | https://localhost:8080 | port-forward |

### 認証情報

| サービス | Username | Password |
|---------|----------|----------|
| Grafana | admin | `kubectl get secret grafana-secrets -n monitoring -o jsonpath='{.data.admin-password}'` |
| Argo CD | admin | `kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' \| base64 -d` |
| PostgreSQL (app) | app | `kubectl get secret pg-app-user -n database -o jsonpath='{.data.password}' \| base64 -d` |

### Port-forward コマンド

```bash
# Grafana
kubectl port-forward svc/grafana -n monitoring 3001:3000

# Prometheus
kubectl port-forward svc/prometheus -n monitoring 9090:9090

# Alertmanager
kubectl port-forward svc/alertmanager -n monitoring 9093:9093

# Argo CD
kubectl port-forward svc/argocd-server -n argocd 8080:443


# Frontend
kubectl port-forward svc/app-frontend-service -n app 3000:3000
```

---

## Argo CD 管理対象

| ディレクトリ | ApplicationSet | 生成 Application |
|-------------|----------------|------------------|
| `apps/` | ecshop-appset | ecshop-app-local |
| `cnpg/` | cnpg-appset | cnpg-database-local |
| `monitoring/` | monitoring-appset | monitoring-stack-local |
| `karpenter/` | 手動 or 別App | - |
| `llm/` | オプション | - |
| `kind/` | NO | - |
| `OLD/` | NO | - |

### ApplicationSet 構成

```yaml
# 単一テンプレートで複数環境を管理
generators:
  - list:
      elements:
        - env: local
          cluster: https://kubernetes.default.svc
        # - env: staging
        # - env: prod
template:
  spec:
    source:
      path: 'infra/k8s/{component}/overlays/{{env}}'
    syncPolicy:
      automated:
        prune: true      # Git削除 → K8s削除
        selfHeal: true   # 手動変更 → Git状態に戻す
```

---

## 監視スタック

### コンポーネント

| コンポーネント | 役割 | namespace |
|---------------|------|-----------|
| Prometheus | メトリクス収集・保存 | monitoring |
| Alertmanager | アラート管理・通知 | monitoring |
| Grafana | ダッシュボード・可視化 | monitoring |
| Loki | ログ集約 | monitoring |
| Promtail | ログ収集 (DaemonSet) | monitoring |
| node-exporter | ノードメトリクス | monitoring |
| kube-state-metrics | K8sオブジェクトメトリクス | kube-system |

### Grafana ダッシュボード

| ダッシュボード | 内容 |
|---------------|------|
| Cluster Overview | クラスタ全体の CPU/Memory、Pod 数 |
| Namespace Overview | namespace 別 CPU/Memory、Pod Status |
| App Backend Metrics | HTTP リクエスト、エラー、メモリ使用量 |

### アラートルール

| ルール | 説明 | 重要度 |
|-------|------|--------|
| PodCrashLoopBackOff | Pod 再起動ループ | critical |
| PodNotReady | Pod 起動失敗 | warning |
| HighCPUUsage | CPU 使用率 80% 超 | warning |
| HighMemoryUsage | メモリ使用率 80% 超 | warning |
| HighErrorRate | HTTP エラー率 5% 超 | critical |
| AppBackendDown | app-backend ダウン | critical |

### Recording Rules

```promql
http_requests:rate5m        # リクエストレート
http_errors:rate5m          # エラーレート
pod:cpu:usage_rate5m        # Pod CPU 使用率
pod:memory:usage_bytes      # Pod メモリ使用量
```

---

## 環境別デプロイ

### Local (Kind)

```bash
# 1. クラスタ作成
kind create cluster --config kind/cluster-config.yaml

# 2. CNPG Operator
kubectl apply --server-side -f \
  https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.24/releases/cnpg-1.24.1.yaml

# 3. Argo CD
kubectl create namespace argocd
kubectl apply -n argocd -f \
  https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 4. SSH 認証設定 (GitHub Private Repo)
kubectl create secret generic github-ssh-key -n argocd \
  --from-file=sshPrivateKey=$HOME/.ssh/id_ed25519

# 5. kube-state-metrics
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/v2.10.1/examples/standard/cluster-role.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/v2.10.1/examples/standard/cluster-role-binding.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/v2.10.1/examples/standard/service-account.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/v2.10.1/examples/standard/deployment.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kube-state-metrics/v2.10.1/examples/standard/service.yaml

# 6. ApplicationSet 適用 (GitOps)
kubectl apply -k argocd/

# 7. 手動デプロイ (Argo CD 未使用時)
kubectl apply -k cnpg/overlays/local
kubectl apply -k apps/overlays/local
kubectl apply -k monitoring/overlays/local
```

### Staging / Production

```bash
# Staging
kubectl apply -k apps/overlays/staging
kubectl apply -k cnpg/overlays/staging

# Production
kubectl apply -k apps/overlays/prod
kubectl apply -k cnpg/overlays/prod
```

---

## アプリケーション構成

### apps/base

| ファイル | 説明 |
|---------|------|
| `namespace.yaml` | app namespace |
| `serviceaccount.yaml` | IRSA 用 ServiceAccount |
| `configmap.yaml` | 環境変数 |
| `secrets.yaml` | DATABASE_URL, JWT_SECRET |
| `backend-deployment.yaml` | Hono API (port 8000) |
| `backend-service.yaml` | Backend Service |
| `frontend-deployment.yaml` | Next.js (port 3000) |
| `frontend-service.yaml` | Frontend Service |
| `ingress.yaml` | ALB Ingress |

### cnpg/base

| ファイル | 説明 |
|---------|------|
| `namespace.yaml` | database namespace |
| `cluster.yaml` | PostgreSQL Cluster (3 replicas) |
| `secrets.yaml` | DB ユーザー認証情報 |

### monitoring/base

| ディレクトリ | 説明 |
|-------------|------|
| `prometheus/` | ConfigMap (scrape, rules), Deployment, Service |
| `alertmanager/` | ConfigMap (通知設定), Deployment, Service |
| `grafana/` | ConfigMap (datasources, dashboards), Secrets, Deployment |
| `loki/` | ConfigMap, StatefulSet, Service |
| `promtail/` | ConfigMap, DaemonSet |
| `node-exporter/` | DaemonSet, Service |

---

## 依存関係

```
apps → cnpg (Service名で参照)
         └── app-postgres-rw.database.svc.cluster.local:5432

monitoring → apps (メトリクス収集)
              └── app-backend-service.app.svc:8000/metrics

monitoring → kube-system
              └── kube-state-metrics:8080
```

---

## ローカル開発チェックリスト

- [ ] `kind create cluster --config kind/cluster-config.yaml`
- [ ] CNPG Operator インストール
- [ ] `kubectl apply -k cnpg/overlays/local` → PostgreSQL 起動確認
- [ ] `kubectl apply -k apps/overlays/local` → Pod 起動確認
- [ ] `kubectl exec -n app deployment/app-backend -- npx prisma db push`
- [ ] `kubectl exec -n app deployment/app-backend -- npx prisma db seed`
- [ ] `curl http://localhost:8000/api/shop/products` → 商品取得
- [ ] `kubectl apply -k monitoring/overlays/local` → 監視スタック起動
- [ ] Grafana ダッシュボード確認 (http://localhost:3001)

---

## 関連ドキュメント

- [Kind セットアップ](kind/README.md)
- [監視スタック](monitoring/README.md)
- [CloudNativePG 公式](https://cloudnative-pg.io/documentation/)
- [Argo CD 公式](https://argo-cd.readthedocs.io/)
- [Kustomize 公式](https://kustomize.io/)
