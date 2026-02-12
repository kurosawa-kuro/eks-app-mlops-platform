# Kind Local Development Environment

Kind (Kubernetes IN Docker) を使用したローカル開発環境のセットアップガイド。

## 前提条件

- Docker Desktop または Docker Engine
- kubectl
- Kind CLI (`~/.local/bin/kind` または `/usr/local/bin/kind`)

### Kind CLI のインストール

```bash
# Linux/WSL
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
mkdir -p ~/.local/bin
mv ./kind ~/.local/bin/kind
export PATH="$HOME/.local/bin:$PATH"

# 確認
kind version
```

## クラスタ構成

```yaml
# cluster-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: dev-cluster
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30080  # Backend API
        hostPort: 8000
        protocol: TCP
```

## クイックスタート

### 1. クラスタ作成

```bash
kind create cluster --config cluster-config.yaml
kubectl cluster-info --context kind-dev-cluster
```

### 2. CNPG Operator のインストール

```bash
kubectl apply --server-side -f \
  https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.24/releases/cnpg-1.24.1.yaml

# 確認
kubectl wait --for=condition=Ready pods \
  -l app.kubernetes.io/name=cloudnative-pg \
  -n cnpg-system --timeout=120s
```

### 3. CNPG デプロイ

```bash
kubectl apply -k ../cnpg/overlays/local

# PostgreSQL 起動確認
kubectl get pods -n database
kubectl get svc -n database
```

### 4. アプリケーションデプロイ

```bash
# ローカルイメージをビルド
cd /path/to/apps/app-backend
docker build -t app-backend:local .

cd /path/to/apps/app-frontend
docker build --build-arg NEXT_PUBLIC_API_URL=http://app-backend-service.app.svc.cluster.local:8000 \
  -t app-frontend:local .

# Kind にイメージをロード
kind load docker-image app-backend:local --name dev-cluster
kind load docker-image app-frontend:local --name dev-cluster

# デプロイ
kubectl apply -k ../apps/overlays/local
```

### 5. Prisma マイグレーション

```bash
# Pod 起動待ち
kubectl wait --for=condition=Ready pods \
  -l app.kubernetes.io/name=app-backend \
  -n app --timeout=60s

# マイグレーション実行
kubectl exec -n app deployment/app-backend -- npx prisma db push --accept-data-loss

# シード実行
kubectl exec -n app deployment/app-backend -- npx prisma db seed
```

## アクセス方法

### Backend API (NodePort 経由)

```bash
# cluster-config.yaml で hostPort: 8000 → containerPort: 30080 をマッピング済み
curl http://localhost:8000/health
curl http://localhost:8000/api/shop/products
```

### Frontend (port-forward)

```bash
kubectl port-forward -n app svc/app-frontend-service 3000:3000
# → http://localhost:3000
```

## データベース接続情報

| 項目 | 値 |
|-----|-----|
| Host | `app-postgres-rw.database.svc.cluster.local` |
| Port | `5432` |
| Database | `appdb` |
| User | `appuser` |
| Password | `CHANGE_ME_APP_USER_PASSWORD` |
| Schema | `ecshop` |

### DATABASE_URL

```
postgresql://appuser:CHANGE_ME_APP_USER_PASSWORD@app-postgres-rw.database.svc.cluster.local:5432/appdb
```

## ディレクトリ構成

```
infra/k8s/
├── kind/                    # Kind クラスタ設定
│   ├── cluster-config.yaml
│   └── README.md
├── cnpg/                    # CloudNativePG
│   ├── base/
│   │   ├── namespace.yaml
│   │   ├── cluster.yaml
│   │   └── secrets.yaml
│   └── overlays/
│       └── local/           # Kind 用オーバーレイ
├── apps/                    # アプリケーション
│   ├── base/
│   │   ├── backend-deployment.yaml
│   │   ├── frontend-deployment.yaml
│   │   └── secrets.yaml
│   └── overlays/
│       └── local/           # Kind 用オーバーレイ
└── OLD/                     # 旧マニフェスト
```

## トラブルシューティング

### ポート競合

```bash
# 使用中のポートを確認
lsof -i :8000
lsof -i :3000

# プロセスを終了
kill <PID>
# または
fuser -k 8000/tcp
```

### イメージが見つからない

```bash
# イメージが Kind にロードされているか確認
docker exec dev-cluster-control-plane crictl images | grep app-

# 再ロード
kind load docker-image app-backend:local --name dev-cluster
```

### Pod が起動しない

```bash
# イベント確認
kubectl describe pod -n app -l app.kubernetes.io/name=app-backend

# ログ確認
kubectl logs -n app deployment/app-backend --tail=50
```

### データベース接続エラー

```bash
# CNPG クラスタ状態
kubectl get cluster -n database

# PostgreSQL Pod ログ
kubectl logs -n database -l cnpg.io/cluster=app-postgres

# Pod 内から接続テスト
kubectl exec -n app deployment/app-backend -- \
  wget -qO- http://app-postgres-rw.database.svc.cluster.local:5432 || echo "Connection test"
```

## クリーンアップ

```bash
# アプリケーション削除
kubectl delete -k ../apps/overlays/local

# CNPG 削除
kubectl delete -k ../cnpg/overlays/local

# クラスタ削除
kind delete cluster --name dev-cluster
```

## 関連ドキュメント

- [Kind 公式ドキュメント](https://kind.sigs.k8s.io/)
- [CloudNativePG ドキュメント](https://cloudnative-pg.io/documentation/)
- [Prisma CLI リファレンス](https://www.prisma.io/docs/reference/api-reference/command-reference)
