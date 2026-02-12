# Kubernetes Secret 運用ガイド

全てのコマンドは **WSL（ローカル）** で実行します。

## 方式

**Option A: Plain K8s Secret + .gitignore**
- シンプルで確実
- secret.yaml は Git にコミットしない
- EKS Private Endpoint 構成との相性が良い

---

## ファイル構成

| ファイル | 用途 | Git |
|---------|------|-----|
| `secret.yaml` | 機密情報（DB接続等） | ❌ |
| `configmap.yaml` | 非機密設定値 | ✅ |
| `secret.md` | このドキュメント | ✅ |

---

## 初回セットアップ

### 1. secret.yaml を作成

```bash
cd /home/wsl/local_ubuntu/k8s-ml-app-platform/infra/k8s/overlays/prod

# 実際の認証情報で作成
kubectl -n app create secret generic hono-app-secret \
  --from-literal=DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" \
  --from-literal=MONGODB_URI="mongodb+srv://user:pass@cluster/db" \
  --from-literal=JWT_SECRET="your-32-char-secret" \
  --dry-run=client -o yaml > secret.yaml
```

### 2. デプロイ

```bash
cd /home/wsl/local_ubuntu/k8s-ml-app-platform/infra/terraform/prod
make deploy
```

---

## 認証情報を更新する場合

1. `secret.yaml` を編集
2. `make deploy` を実行
3. Pod が自動で再起動される（または手動で `kubectl rollout restart`）

---

## 注意事項

- `secret.yaml` は `.gitignore` に追加済み
- 絶対に Git にコミットしないこと
- 本番環境の認証情報は安全に管理すること
