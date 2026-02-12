# Hono App Backend

Hono + TypeScript API application with EC Shop functionality.

## Overview

| Item | Value |
|------|-------|
| Framework | Hono 4.x (TypeScript ESM) |
| Runtime | Node.js 20 |
| Database | PostgreSQL (Neon Cloud / Local Docker) |
| ORM | Prisma 6.x |
| Auth | JWT (Jose) |

---

## Quick Start

```bash
# セットアップ & 開発サーバー起動
make setup
make dev

# フロントエンド + バックエンド同時起動
make setup-all
make dev-all
```

---

## Make Commands

```bash
make help  # 全コマンド一覧
```

### Development

| Command | Description |
|---------|-------------|
| `make dev` | 開発サーバー起動 (port 8000) |
| `make build` | 本番ビルド |
| `make test` | Unit tests |
| `make test-e2e` | E2E tests (Playwright) |
| `make check` | typecheck + test |
| `make setup` | 依存インストール |

### Full-Stack (Frontend + Backend)

| Command | Description |
|---------|-------------|
| `make dev-all` | 両方同時起動 (BE:8000, FE:3000) |
| `make build-all` | 両方ビルド |
| `make test-all` | 全テスト実行 |
| `make setup-all` | 両方セットアップ |

### Database (Prisma)

| Command | Description |
|---------|-------------|
| `make db-migrate` | マイグレーション実行 |
| `make db-seed` | 初期データ投入 |
| `make db-reset` | DB リセット (migrate + seed) |
| `make db-studio` | Prisma Studio 起動 |
| `make db-generate` | Prisma Client 生成 |

### Docker & Kind

| Command | Description |
|---------|-------------|
| `make docker-build` | Backend イメージビルド |
| `make docker-build-all` | Frontend + Backend ビルド |
| `make kind-create` | Kind クラスター作成 |
| `make kind-load` | イメージをKindにロード |
| `make kind-deploy` | Kustomize でデプロイ |
| `make kind-status` | Pod/Service 確認 |
| `make kind-logs` | ログ表示 |

### CI

| Command | Description |
|---------|-------------|
| `make ci` | CI パイプライン実行 |

---

## Database Setup

### Neon Cloud

```bash
cat > .env <<EOF
DATABASE_URL="postgresql://neondb_owner:xxx@ep-xxx.aws.neon.tech/ecshop?sslmode=require"
JWT_SECRET="your-jwt-secret"
EOF

make db-generate
make db-migrate
make db-seed
make dev
```

### Local Docker

```bash
docker compose up -d

cat > .env <<EOF
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ecshop?schema=public"
JWT_SECRET="dev-secret"
EOF

make db-migrate
make db-seed
make dev
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | PostgreSQL 接続文字列 |
| `JWT_SECRET` | - | JWT 署名キー |
| `PORT` | `8000` | サーバーポート |
| `NODE_ENV` | `development` | 環境 |

---

## Authentication

### Test Users (Development Only)

| Email | Password | Role |
|-------|----------|------|
| user1@example.com | (see .env) | user |
| admin@example.com | (see .env) | admin |

```bash
# Dev ログイン (パスワード検証なし)
curl -X POST http://localhost:8000/api/dev/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"any"}'
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | ヘルスチェック |
| GET | `/metrics` | Prometheus メトリクス |
| POST | `/api/dev/login` | 開発ログイン |
| GET | `/api/me` | ユーザー情報 |
| GET | `/shop/products` | 商品一覧 |
| GET | `/shop/cart` | カート |
| POST | `/shop/checkout` | チェックアウト |

---

## Related

- [CLAUDE.md](../../CLAUDE.md) - プロジェクト全体ガイド
- [Auth Service](../auth/) - 認証サービス
- [Infrastructure](../../infra/) - Terraform / K8s 設定
