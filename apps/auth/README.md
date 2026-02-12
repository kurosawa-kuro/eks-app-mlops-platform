# Auth Service

認証ゲートウェイサービス（JWT / RBAC / 監査ログ / トークンブラックリスト）

> **Note (2025-12):** Lambda デプロイは廃止されました。現在は Render にデプロイされています。
> - **本番 URL:** https://your-auth-gateway.example.com
> - デプロイ方法: [README-Render.md](./README-Render.md) を参照

---

## 概要

| 項目 | 内容 |
|------|------|
| 用途 | 認証・認可 API サーバー |
| フレームワーク | Hono 4.x + TypeScript (ESM) |
| 認証方式 | Dummy（開発用）/ Cognito（本番用）|
| DI | Awilix（`InjectionMode.CLASSIC`） |
| デプロイ形態 | Node.js / Render (推奨) / Docker |

---

## クイックスタート

### 1. 依存関係インストール

```bash
cd apps/auth
npm install
```

### 2. 環境変数設定

```bash
cp .env.example .env
```

### 3. 開発サーバー起動

```bash
npm run dev
```

http://localhost:38002 でアクセス可能

---

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動（tsx watch によるホットリロード） |
| `npm run build` | TypeScript ビルド |
| `npm run start` | 本番サーバー起動 |
| `npm test` | ユニットテスト（Jest ESM） |
| `npm run test:e2e` | E2E テスト（Playwright） |

---

## 環境変数

### 基本設定

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `PORT` | 38002 | サーバーポート |
| `NODE_ENV` | development | 環境（development/production/test） |
| `JWT_SECRET` | dummy-secret-key-for-development | JWT 署名キー |

### 認証プロバイダー

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `AUTH_PROVIDER` | cognito | 認証方式（dummy/cognito） |
| `COGNITO_USER_POOL_ID` | - | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | - | Cognito Client ID |
| `COGNITO_REGION` | ap-northeast-1 | AWS リージョン |

### トークン設定

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `ACCESS_TOKEN_TTL` | 3600 | アクセストークン有効期限（秒） |
| `REFRESH_TOKEN_TTL` | 604800 | リフレッシュトークン有効期限（秒） |
| `REDIS_URL` | - | Redis URL（分散ブラックリスト用） |

---

## デプロイ

### Node.js サーバー

```bash
npm run build
npm run start
```

### Docker

```bash
docker build -t auth-service .
docker run -p 38002:10000 auth-service
```

> Dockerfile 内部では `PORT=10000` をデフォルトで使用。外部からの接続は適宜マッピング。

---

## 運用

### ヘルスチェック

```bash
curl http://localhost:38002/health
```

```json
{
  "status": "ok",
  "timestamp": "2025-12-21T00:00:00.000Z",
  "uptime": 123.456
}
```

### 認証テスト（Dummy モード）

```bash
# ログイン
curl -X POST http://localhost:38002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'

# ユーザー情報取得
curl http://localhost:38002/auth/me \
  -H "Authorization: Bearer <token>"
```

### ログイン検証（Cognito PoC ユーザー）

```bash
./scripts/verify-poc-users.sh
```

---

## API エンドポイント

| メソッド | パス | 認証 | 説明 |
|----------|------|------|------|
| GET | `/` | 不要 | API 情報（プロバイダー表示は `AUTH_PROVIDER` に連動） |
| GET | `/health` | 不要 | ヘルスチェック |
| GET | `/health/status` | 不要 | ヘルスステータス（エイリアス） |
| POST | `/auth/login` | 不要 | ログイン（レート制限: 5 req/min） |
| GET | `/auth/me` | 任意 | ユーザー情報取得 |
| POST | `/auth/refresh` | 不要 | トークン更新 |
| POST | `/auth/logout` | 任意 | ログアウト |

---

## ディレクトリ構成

```
apps/auth/
├── src/
│   ├── adapters/           # 認証・ブラックリストアダプター
│   │   ├── auth/           # BaseAuthAdapter, DummyAuthAdapter, CognitoAuthAdapter
│   │   └── blacklist/      # InMemoryBlacklist, RedisBlacklist
│   ├── config/             # 環境変数 (env.ts)・ロガー (logger.ts)
│   ├── container/          # DI コンテナ (index.ts)・型定義 (types.ts)
│   ├── domain/types/       # ドメインモデル・RBAC 定義
│   ├── middleware/         # auth, rbac, auditLog, rateLimit
│   ├── routes/             # auth (4 ルート), health (2 ルート)
│   ├── services/           # JwtService
│   ├── usecases/           # AuthUseCase
│   ├── utils/              # token (Bearer/Cookie 抽出), ip (クライアント IP 取得)
│   ├── app.ts              # Hono アプリケーション構成
│   ├── index.ts            # Node.js サーバーエントリーポイント
│   └── lambda-handler.ts   # AWS Lambda ハンドラー（廃止予定）
├── tests/                  # unit/ + e2e/
├── scripts/                # PoC ユーザー管理スクリプト
├── Dockerfile              # マルチステージビルド
└── *.md                    # ドキュメント
```

---

## 認証プロバイダー

### Dummy モード（開発用）

```bash
AUTH_PROVIDER=dummy
```

- 設定不要で即座に利用可能
- ハードコードユーザー:

  | ユーザー名 | パスワード | ロール |
  |-----------|----------|--------|
  | `admin` | `password` | admin |
  | `user` | `password` | user |
  | `viewer` | `password` | guest |

- 本番環境では使用禁止

### Cognito モード（本番用）

```bash
AUTH_PROVIDER=cognito
COGNITO_USER_POOL_ID=ap-northeast-1_xxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxx
```

- AWS Cognito User Pool と統合
- JWKS によるトークン検証
- コンストラクタで `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` 未設定時に警告ログ出力
- PoC ユーザーは [README-User Cognito.md](./README-User%20Cognito.md) を参照

---

## スクリプト

| スクリプト | 説明 |
|-----------|------|
| `scripts/setup-poc-users.sh` | PoC ユーザー一括作成（Cognito へ登録） |
| `scripts/verify-poc-users.sh` | PoC ユーザーログイン検証 |

---

## 関連ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| [README-実装状況.md](./README-実装状況.md) | 実装詳細（API仕様、ミドルウェア、テスト等） |
| [README-User Cognito.md](./README-User%20Cognito.md) | Cognito ユーザー管理ガイド |
| [README-Render.md](./README-Render.md) | Render デプロイガイド |

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| ランタイム | Node.js 20+ |
| フレームワーク | Hono 4.x |
| JWT | jose |
| バリデーション | Zod |
| DI | Awilix |
| ロガー | Pino (+ pino-pretty) |
| AWS SDK | @aws-sdk/client-cognito-identity-provider |
| Redis | ioredis |
| テスト | Jest (ESM), Playwright |

---

## トラブルシューティング

### ポートが使用中

```bash
lsof -i :38002
kill -9 <PID>
```

### Cognito 認証エラー

```bash
aws cognito-idp admin-get-user \
  --user-pool-id <pool-id> \
  --username <email>
```

### テスト失敗

```bash
# 環境変数を確認
cat .env

# テスト実行（詳細ログ）
npm test -- --verbose
```

---

## ライセンス

MIT
