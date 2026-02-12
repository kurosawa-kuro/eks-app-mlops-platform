# Hono Backend Starter

> **スターターキット用ドキュメント**
> 本ドキュメントは、新規プロジェクト開始時の構築・運用ガイドです。
> プロジェクト開始後は、プロジェクト固有の内容に書き換えてご利用ください。

TypeScript + Hono + EJS + Awilix (DI) のバックエンドスターターキット

> **対象ユースケース**: PCデスクトップ向け管理画面・業務アプリケーション
> スマートフォン向けのレスポンシブデザインは考慮されていません。

## Tech Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| Runtime | Node.js | JavaScript runtime |
| Framework | Hono | 軽量・高速 Web framework |
| Language | TypeScript | 型安全な開発 |
| Template | EJS | サーバーサイドレンダリング |
| DI | Awilix | 依存性注入コンテナ |
| Database | MongoDB | ドキュメントDB |
| Auth | Clerk | 認証・ユーザー管理 |
| Validation | Zod | スキーマバリデーション |
| Logging | Pino | 高速ロギング |
| Secret管理 | Doppler | 環境変数・シークレット管理 |
| Test | Vitest | ユニットテスト |
| E2E Test | Playwright | ブラウザテスト |

---

## Quick Start

```bash
# 1. 依存関係インストール
npm install

# 2. Doppler設定（推奨）
doppler setup

# 3. MongoDB起動 (Docker)
docker compose up -d

# 4. 開発サーバー起動
npm run dev
# または Doppler経由
doppler run -- npm run dev

# → http://localhost:8001
```

### 最小構成（Doppler なし）

```bash
# .env ファイルを作成
cat > .env << 'EOF'
PORT=8001
NODE_ENV=development
DB_MONGODB_URI=mongodb://localhost:27017/starter
DB_MONGODB_DB_NAME=starter
USE_AUTH=false
EOF

# 起動
npm run dev
```

---

## Project Structure

```
src/
├── index.ts                 # エントリーポイント
├── app.ts                   # Hono アプリケーション生成
├── env/                     # 環境設定
│   ├── schema.ts            # Zodスキーマ (AppConfig)
│   ├── loader.ts            # 設定読み込み
│   └── index.ts             # エクスポート
├── di/
│   └── container.ts         # Awilix DIコンテナ設定
├── shared/
│   └── logger.ts            # Pino ロガー設定
│
├── domain/                  # ドメイン層（ビジネスロジック）
│   ├── entities/            # エンティティ定義
│   ├── repositories/        # リポジトリインターフェース
│   ├── services/            # ドメインサービス
│   └── usecases/            # ユースケース
│
├── infra/                   # インフラ層（実装詳細）
│   ├── database/clients/    # DB接続・クライアント
│   ├── repositories/        # リポジトリ実装
│   └── services/            # サービス実装
│
└── presentation/            # プレゼンテーション層（HTTP）
    ├── routes/              # ルート定義
    │   └── auth/            # 認証ルート
    ├── controllers/         # HTTPハンドラー
    ├── middleware/          # ミドルウェア
    │   └── auth.ts          # 認証ミドルウェア
    ├── validators/          # リクエストバリデーション
    ├── schemas/             # Zodスキーマ
    ├── helpers/             # ヘルパー関数
    ├── views/               # EJSテンプレート
    └── public/              # 静的ファイル
```

### Architecture（Clean Architecture）

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer (HTTP)                                  │
│  ├── Routes → Controllers → Middleware                      │
│  └── Views (EJS)                                            │
├─────────────────────────────────────────────────────────────┤
│  Domain Layer (Business Logic)                              │
│  ├── Entities (データ構造)                                   │
│  ├── Repositories (インターフェース)                          │
│  └── UseCases (ビジネスルール)                                │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Layer (Implementation)                      │
│  ├── DB Clients (MongoDB)                                   │
│  └── Repository Implementations                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

### Doppler（推奨）

```bash
# プロジェクト設定
doppler setup

# シークレット一覧
doppler secrets

# 開発サーバー起動
doppler run -- npm run dev
```

### 環境変数一覧

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | サーバーポート | `8001` | No |
| `NODE_ENV` | 環境名 | `development` | No |
| `PROJECT_NAME` | プロジェクト名 | `app` | No |
| `LOG_LEVEL` | ログレベル | `info` | No |
| `DB_MONGODB_URI` | MongoDB接続文字列 | - | Yes |
| `DB_MONGODB_DB_NAME` | MongoDBデータベース名 | `starter` | No |
| `JWT_SECRET` | JWT署名用シークレット | - | No |
| `USE_AUTH` | Clerk認証有効化 | `false` | No |
| `CLERK_SECRET_KEY` | Clerk Secret Key | - | USE_AUTH=true時 |
| `CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key | - | USE_AUTH=true時 |
| `OWNER_USER_ID` | オーナー限定アクセス用ユーザーID | - | No |

---

## Authentication (Clerk)

### 有効化

```bash
# Doppler
doppler secrets set USE_AUTH=true
doppler secrets set CLERK_SECRET_KEY=sk_test_xxx
doppler secrets set CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

### オーナー限定モード

特定ユーザーのみアクセス可能にする場合：

```bash
# Clerk Dashboard → Users → User ID をコピー
doppler secrets set OWNER_USER_ID=user_xxxxx
```

### 動作モード

| USE_AUTH | OWNER_USER_ID | 動作 |
|----------|---------------|------|
| false | - | 認証なし（全員アクセス可） |
| true | 未設定 | Clerkログイン必須 |
| true | 設定済み | 指定ユーザーのみアクセス可 |

> 詳細は [docs/04-機能ガイド/01-clerk認証.md](./docs/04-機能ガイド/01-clerk認証.md) を参照

---

## Commands

### npm scripts

```bash
npm run dev        # 開発サーバー起動（ホットリロード）
npm run build      # TypeScriptビルド
npm start          # 本番サーバー起動
npm test           # ユニットテスト (Vitest)
npm run test:watch # ウォッチモード
npm run test:e2e   # E2Eテスト (Playwright)
```

### Makefile

```bash
make help          # コマンド一覧表示

# Setup
make install       # npm install
make setup         # install + .env作成

# Development
make dev           # ポート解放 + 開発サーバー起動
make build         # TypeScriptビルド
make start         # 本番サーバー起動

# Docker
make docker-up     # MongoDB + Mongo Express 起動
make docker-down   # コンテナ停止
make docker-logs   # コンテナログ表示

# Testing
make test          # ユニットテスト (Vitest)
make test-watch    # ウォッチモード
make test-e2e      # E2Eテスト (Playwright)
make test-e2e-ui   # E2Eテスト (UI付き)
make test-e2e-headed # E2Eテスト (ブラウザ表示)

# Utilities
make kill-port     # ポート8001を解放
make clean         # ビルド成果物削除
```

---

## Routes

### 画面

| パス | 説明 | 認証 |
|------|------|------|
| `/` | → `/dashboard` へリダイレクト | - |
| `/auth/login` | ログインページ | 不要 |
| `/dashboard` | ダッシュボード | 必要* |
| `/dashboard/samples` | サンプル一覧 | 必要* |
| `/settings` | 設定管理 | 必要* |
| `/admin` | 管理画面 | 必須 |
| `/devtool` | 開発ツール | 必要* |
| `/system/jobs` | ジョブ管理 | 必要* |

> *認証: `USE_AUTH=true` 時のみ。`OWNER_USER_ID` 設定時はオーナーのみ。

### API

| エンドポイント | 説明 | 認証 |
|----------------|------|------|
| `GET /api/health` | ヘルスチェック | 不要 |
| `GET /api/info` | アプリ情報 | 不要 |
| `GET /auth/status` | 認証ステータス | 不要 |
| `GET /auth/me` | 現在のユーザー | 不要 |
| `/dashboard/samples/api/*` | サンプルCRUD | 必要* |
| `/settings/api/*` | 設定API | 必要* |
| `/system/jobs/api/*` | ジョブAPI | 必要* |

> 詳細は [docs/06-リファレンス/01-実装状況.md](./docs/06-リファレンス/01-実装状況.md) を参照

---

## Database Configuration

### MongoDB (Docker)

```bash
# 起動
docker compose up -d

# MongoDB: localhost:27017
# Mongo Express (WebUI): http://localhost:8081
#   user: admin / pass: admin
```

### MongoDB Atlas (Cloud)

```bash
doppler secrets set DB_MONGODB_URI="mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/starter"
doppler secrets set DB_MONGODB_DB_NAME=starter
```

---

## Security Features

### Rate Limiting

```typescript
// 1分間に100リクエストまで (IP単位)
windowMs: 60 * 1000
limit: 100
```

- `X-Forwarded-For` / `X-Real-IP` ヘッダー対応
- プロキシ背後での正しいIP取得

### Clerk Authentication

```bash
USE_AUTH=true
CLERK_SECRET_KEY=sk_test_xxx
CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

- ログイン/ログアウトUI自動生成
- セッション管理
- オーナー限定モード対応

---

## Testing

### Unit Tests (Vitest)

```bash
npm test
npm run test:watch
```

テストファイル: `test/integration/*.test.ts`

### E2E Tests (Playwright)

```bash
npm run test:e2e         # Headless
npm run test:e2e:ui      # Interactive UI
npm run test:e2e:headed  # ブラウザ表示
```

テストファイル: `e2e/*.spec.ts`

設定: `playwright.config.ts`
- baseURL: `http://localhost:8001`
- Browser: Chromium
- 自動でdev server起動

---

## Deployment

### Build

```bash
npm run build
# → dist/ に出力
```

### Production Start

```bash
NODE_ENV=production npm start
```

### Docker (例)

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

ENV PORT=8001
ENV NODE_ENV=production

EXPOSE 8001
CMD ["node", "dist/index.js"]
```

---

## Development Tips

### 新しいエンドポイントの追加手順

1. **Entity作成** (`domain/entities/`)
2. **Repository Interface作成** (`domain/repositories/`)
3. **Repository Implementation作成** (`infra/repositories/`)
4. **UseCase作成** (`domain/usecases/`)
5. **Controller作成** (`presentation/controllers/`)
6. **Route作成** (`presentation/routes/`)
7. **DIコンテナ登録** (`di/container.ts`)
8. **ルートマウント** (`presentation/routes/index.ts`)

### ミドルウェア

| Middleware | 説明 |
|------------|------|
| rateLimiter | 100 req/min/IP |
| requestLogger | リクエストID生成 |
| errorHandler | エラーハンドリング |
| apiKeyAuth | API Key認証 |
| authMiddleware | Clerk認証 |
| ownerOnly | オーナー限定 |

> 詳細は [docs/06-リファレンス/01-実装状況.md](./docs/06-リファレンス/01-実装状況.md) を参照

### ログ確認

```bash
# 開発時は pino-pretty で整形出力
npm run dev

# 本番は JSON形式
npm start
```

---

## Troubleshooting

### Port already in use

```bash
make kill-port
# または
fuser -k 8001/tcp
```

### MongoDB connection failed

```bash
# Docker起動確認
docker compose ps

# 接続テスト
curl http://localhost:8001/api/health
```

### TypeScript build errors

```bash
# node_modules再インストール
rm -rf node_modules
npm install
npm run build
```

---

## 関連ドキュメント

| カテゴリ | ドキュメント | 説明 |
|----------|-------------|------|
| 機能ガイド | [Clerk認証](./docs/04-機能ガイド/01-clerk認証.md) | Clerk認証の使い方 |
| 機能ガイド | [Clerk認証削除](./docs/04-機能ガイド/02-clerk認証削除.md) | Clerk認証の削除方法 |
| 機能ガイド | [Sample機能削除](./docs/04-機能ガイド/03-sample機能削除.md) | サンプル機能の削除方法 |
| セットアップ | [Doppler](./docs/05-セットアップ/01-doppler.md) | Doppler連携ガイド |
| リファレンス | [実装状況](./docs/06-リファレンス/01-実装状況.md) | 実装状況サマリ |

## License

MIT
