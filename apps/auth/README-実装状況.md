# Auth Service ― 実装状況サマリ

> **認証ゲートウェイサービス**
> 本ドキュメントは、Auth Service の実装詳細を記載しています。
> JWT 認証、RBAC、監査ログ、トークンブラックリストを提供する認証ゲートウェイです。

> **デプロイ形態**: Node.js サーバー / Render (推奨) / Docker

---

## TypeScript + Hono + Awilix (DI) の認証サービス 実装済み機能

### 公開ルート（API）

#### エンドポイント一覧

| メソッド | パス | 認証 | 説明 |
|----------|------|------|------|
| GET | `/` | 不要 | API 情報・プロバイダーステータス・エンドポイント一覧 |
| GET | `/health` | 不要 | ヘルスチェック（timestamp, uptime 含む） |
| GET | `/health/status` | 不要 | ヘルスステータス（エイリアス） |
| POST | `/auth/login` | 不要 | ログイン・JWT トークン発行 |
| GET | `/auth/me` | 任意 | 認証ユーザー情報取得（未認証時は `authenticated: false`） |
| POST | `/auth/refresh` | 不要 | アクセストークン更新 |
| POST | `/auth/logout` | 任意 | ログアウト・トークン無効化 |

#### API（JSON）

* **API 情報**

  * `GET /`
  * 状態: 実装済み
  * 応答:
    ```json
    {
      "name": "auth-service",
      "description": "Authentication service (dummy)",
      "provider": "dummy",
      "endpoints": {
        "login": "POST /auth/login",
        "logout": "POST /auth/logout",
        "me": "GET /auth/me",
        "refresh": "POST /auth/refresh",
        "health": "GET /health"
      }
    }
    ```
  * 備考: `description` と `provider` は `AUTH_PROVIDER` 環境変数に連動して動的に変化

* **ヘルスチェック**

  * `GET /health`
  * 状態: 実装済み
  * 応答:
    ```json
    {
      "status": "ok",
      "timestamp": "2025-01-01T00:00:00.000Z",
      "uptime": 123.456
    }
    ```
  * 備考: Kubernetes / Docker ヘルスチェック用

* **ログイン**

  * `POST /auth/login`
  * 状態: 実装済み
  * 入力: `{ "username": "...", "password": "..." }`
  * 応答（成功時）:
    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiJ9...",
      "token_type": "Bearer",
      "expires_in": 3600
    }
    ```
  * 応答（失敗時）:
    ```json
    { "success": false, "message": "Invalid credentials" }
    ```
  * 備考:
    * Bearer トークン + セッション Cookie（httpOnly）両対応
    * レート制限: 5 req/min per IP
    * 監査ログ: `auth.login.success` / `auth.login.failure`
    * Zod によるリクエストバリデーション

* **認証ユーザー情報取得**

  * `GET /auth/me`
  * 状態: 実装済み
  * 認証: `Authorization: Bearer <token>` または `session` Cookie（任意）
  * 応答（認証あり）:
    ```json
    {
      "authenticated": true,
      "user": { "sub": "dummy-admin-id", "email": "admin@example.com", "role": "admin" }
    }
    ```
  * 応答（認証なし/無効トークン）:
    ```json
    { "authenticated": false }
    ```
  * 備考: トークン検証 + ブラックリストチェック

* **トークンリフレッシュ**

  * `POST /auth/refresh`
  * 状態: 実装済み
  * 入力: `{ "refresh_token": "..." }`
  * 応答（成功時）:
    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiJ9...",
      "token_type": "Bearer",
      "expires_in": 3600
    }
    ```
  * 応答（失敗時）:
    ```json
    { "success": false, "message": "Invalid or expired refresh token" }
    ```
  * 備考: リフレッシュトークン専用検証（token_type: "refresh"）

* **ログアウト**

  * `POST /auth/logout`
  * 状態: 実装済み
  * 入力: Bearer トークンまたは `session` Cookie（任意）
  * 応答:
    ```json
    { "message": "logged out" }
    ```
  * 備考:
    * トークンをブラックリストに追加
    * セッション Cookie をクリア
    * 監査ログ: `auth.logout`

---

## 認証アダプター

### アダプター切り替え方式

| プロバイダー | 環境変数 | 用途 |
|-------------|---------|------|
| DummyAuthAdapter | `AUTH_PROVIDER=dummy` | 開発・テスト |
| CognitoAuthAdapter | `AUTH_PROVIDER=cognito` (デフォルト) | 本番（AWS Cognito） |

### DummyAuthAdapter（開発用）

* 状態: **実装完了**
* ハードコードユーザー:

  | ユーザー名 | パスワード | ID | Email | ロール |
  |-----------|----------|-----|-------|--------|
  | `admin` | `password` | `dummy-admin-id` | `admin@example.com` | admin |
  | `user` | `password` | `dummy-user-id` | `user@example.com` | user |
  | `viewer` | `password` | `dummy-viewer-id` | `viewer@example.com` | guest |

* 機能:
  * JWT トークン生成（jose ライブラリ経由 JwtService）
  * トークン検証・ブラックリスト連携
  * リフレッシュトークンフロー
  * ログアウト・トークン無効化

### CognitoAuthAdapter（本番用）

* 状態: **実装済み**
* 機能:
  * AWS SDK 連携（CognitoIdentityProviderClient）
  * USER_PASSWORD_AUTH 認証フロー
  * JWKS リモート検証
  * カスタムロールクレーム（`custom:role`）対応
  * `getUser()` で Cognito ユーザー属性（email, sub, custom:role）を一括取得
  * Cognito エラーハンドリング（NotAuthorized, UserNotFound, UserNotConfirmed）
  * コンストラクタで必須 env 未設定時の警告ログ出力
  * TTL はすべて `ACCESS_TOKEN_TTL` env 設定に連動（ハードコード廃止）
* 制限:
  * NEW_PASSWORD_REQUIRED チャレンジ未対応

### PoC Cognito ユーザー（検証環境用）

* 設定ファイル: `src/config/poc-users.json`
* **警告**: パスワードが含まれるため本番環境では使用禁止

| Email | パスワード | ロール | 説明 |
|-------|----------|--------|------|
| `admin@example.com` | `(see .env)` | admin | 管理者（全権限） |
| `default@example.com` | `(see .env)` | user | デフォルトユーザー |
| `user1@example.com` | `(see .env)` | user | 一般ユーザー |

* Cognito 設定:
  * User Pool ID: `ap-northeast-1_XXXXXXXXX`
  * Client ID: `XXXXXXXXXXXXXXXXXXXXXXXXXX`
  * Region: `ap-northeast-1`

### PoC ユーザー管理スクリプト

| スクリプト | 説明 |
|-----------|------|
| `scripts/setup-poc-users.sh` | PoC ユーザー一括作成（Cognito へ登録） |
| `scripts/verify-poc-users.sh` | PoC ユーザーログイン検証 |

* 前提条件:
  * AWS CLI がインストール・設定済み
  * `jq` がインストール済み
  * AWS 認証情報が設定済み

```bash
# PoC ユーザー作成
./scripts/setup-poc-users.sh

# ログイン検証
./scripts/verify-poc-users.sh
```

---

## トークンブラックリスト

### アダプター切り替え方式

| アダプター | 条件 | 用途 |
|-----------|------|------|
| InMemoryBlacklist | `REDIS_URL` 未設定 | 単一インスタンス |
| RedisBlacklist | `REDIS_URL` 設定済み | 分散環境（K8s） |

### InMemoryBlacklist

* 状態: **実装完了**
* 特徴:
  * 単一インスタンス用（非分散）
  * 5分間隔の自動クリーンアップ
  * `setInterval.unref()` でプロセス終了を阻害しない
  * Graceful shutdown 対応（destroy()）

### RedisBlacklist

* 状態: **実装完了**
* 特徴:
  * 分散環境対応（Kubernetes Ready）
  * ioredis + コネクションプーリング
  * SETEX によるトークン TTL 自動失効
  * トークンハッシュ化（署名部分抽出）
  * 指数バックオフ付きリトライ戦略
  * ヘルスチェック（ping()）
  * Graceful shutdown 対応

---

## ミドルウェア

### 認証・認可ミドルウェア

| ミドルウェア | ファイル | 説明 |
|-------------|---------|------|
| createAuthMiddleware() | `middleware/auth.ts` | トークン抽出・検証、`user` & `token` コンテキスト設定 |
| requireAuth() | `middleware/rbac.ts` | 認証必須（未認証時 401） |
| requireRole() | `middleware/rbac.ts` | 特定ロール必須（RBAC） |
| requirePermission() | `middleware/rbac.ts` | いずれかの権限必須 |
| requireAllPermissions() | `middleware/rbac.ts` | すべての権限必須 |

### セキュリティミドルウェア

| ミドルウェア | ファイル | 説明 |
|-------------|---------|------|
| loginRateLimit | `middleware/rateLimit.ts` | ログイン: 5 req/min per IP（`.unref()` 付き） |
| apiRateLimit | `middleware/rateLimit.ts` | API: 100 req/15min per IP |
| createAuditLogger() | `middleware/auditLog.ts` | 監査イベントロギング（戻り型: `IAuditLogger`） |
| auditLogMiddleware() | `middleware/auditLog.ts` | 自動監査ログラッパー |

---

## RBAC（ロールベースアクセス制御）

### ロール定義

| ロール | 説明 |
|--------|------|
| admin | 管理者（全権限） |
| admin-read-only | 読み取り専用管理者 |
| user | 一般ユーザー（read:users, read:analytics） |
| guest | ゲスト（権限なし） |

### 権限定義

| 権限 | admin | admin-read-only | user | guest |
|------|-------|-----------------|------|-------|
| read:users | o | o | o | - |
| write:users | o | - | - | - |
| delete:users | o | - | - | - |
| read:analytics | o | o | o | - |
| write:analytics | o | - | - | - |
| admin:all | o | - | - | - |

### ヘルパー関数

* `hasPermission(user, permission)` - 単一権限チェック
* `hasAnyPermission(user, permissions)` - いずれかの権限チェック
* `hasAllPermissions(user, permissions)` - すべての権限チェック

---

## 監査ログ

### 記録されるイベント

| イベント | トリガー |
|---------|---------|
| `auth.login.success` | ログイン成功（ユーザー詳細含む） |
| `auth.login.failure` | ログイン失敗（ユーザー名・理由含む） |
| `auth.logout` | ログアウト |
| `auth.token.verify` | トークン検証結果 |
| `auth.token.refresh` | トークン更新結果 |
| `auth.access.denied` | RBAC 拒否 |
| `auth.access.granted` | アクセス許可 |

### IP アドレス抽出

`getClientIp()` ユーティリティ（`utils/ip.ts`）で共通化:

1. `X-Forwarded-For` ヘッダー（カンマ区切りの場合は最初の IP）
2. `X-Real-IP` ヘッダー（フォールバック）
3. "unknown"（ヘッダー無し）

---

## サービス層

### JwtService

* 状態: **実装完了**
* 機能:
  * HS256 署名によるトークン生成
  * アクセストークン（短命、デフォルト 1 時間）
  * リフレッシュトークン（長命、デフォルト 7 日）
  * トークンタイプ検証（`??` による安全なデフォルト値）
  * 期限切れ/無効トークンのハンドリング
  * jose ライブラリ使用

### AuthUseCase

* 状態: **実装完了**
* 機能:
  * login / verify / refresh / logout のビジネスロジック
  * IAuthAdapter を介したプラガブルな認証
  * accessTokenTTL プロパティ公開

---

## ロギング

* **Pino** によるログ出力
  * 開発時: `pino-pretty` でカラー表示
  * 本番時: JSON 形式
  * ログレベル: `NODE_ENV` に応じて自動決定（dev/test=debug, prod=info）

---

## バリデーション

* **Zod** によるスキーマバリデーション
  * `src/config/env.ts`: 環境変数バリデーション
  * `src/routes/auth.ts`: ログイン・リフレッシュリクエストバリデーション

---

## テスト

### ユニットテスト（Jest ESM）

| ファイル | 説明 | テスト数 |
|---------|------|---------|
| `tests/unit/services/JwtService.test.ts` | JWT 操作テスト | 13 |
| `tests/unit/adapters/DummyAuthAdapter.test.ts` | Dummy 認証テスト | 14 |
| `tests/unit/adapters/CognitoAuthAdapter.test.ts` | Cognito テスト（一部 skip） | 3 (+3 skip) |
| `tests/unit/adapters/blacklist/InMemoryBlacklist.test.ts` | ブラックリストテスト | 8 |
| `tests/unit/middleware/rbac.test.ts` | RBAC ミドルウェアテスト | 12 |
| `tests/unit/middleware/auditLog.test.ts` | 監査ログテスト | 12 |
| `tests/unit/usecases/AuthUseCase.test.ts` | ユースケーステスト | 4 |
| `tests/unit/app.test.ts` | API エンドポイントテスト | 10 |
| **合計** | **8 スイート** | **76 pass / 3 skip** |

### E2E テスト（Playwright）

| ファイル | 説明 |
|---------|------|
| `tests/e2e/basic.test.ts` | 認証フロー E2E テスト |

### テスト実行

```bash
npm test                  # Jest ユニットテスト
npm run test:e2e          # Playwright E2E テスト（ポート 38002）
```

---

## 環境変数

### 実装状態

| 変数 | 状態 | 用途 | デフォルト |
|------|------|------|-----------|
| PORT | 使用中 | サーバーポート | 38002 |
| NODE_ENV | 使用中 | 環境名 | development |
| JWT_SECRET | 使用中 | JWT 署名キー | dummy-secret-key-for-development |
| AUTH_PROVIDER | 使用中 | 認証プロバイダー（dummy/cognito） | cognito |
| ACCESS_TOKEN_TTL | 使用中 | アクセストークン有効期限（秒） | 3600 |
| REFRESH_TOKEN_TTL | 使用中 | リフレッシュトークン有効期限（秒） | 604800 |
| COGNITO_USER_POOL_ID | 条件付き | Cognito ユーザープール ID | - |
| COGNITO_CLIENT_ID | 条件付き | Cognito クライアント ID | - |
| COGNITO_REGION | 使用中 | Cognito リージョン | ap-northeast-1 |
| REDIS_URL | オプション | Redis 接続 URL（ブラックリスト用） | - |

---

## ディレクトリ構成

```
scripts/
├── setup-poc-users.sh          # PoC Cognito ユーザー一括作成
└── verify-poc-users.sh         # PoC ユーザーログイン検証

src/
├── index.ts                    # Node.js サーバーエントリーポイント
├── lambda-handler.ts           # AWS Lambda ハンドラー（廃止予定）
├── app.ts                      # Hono アプリケーション構成
│
├── config/
│   ├── env.ts                  # 環境変数 Zod バリデーション
│   ├── logger.ts               # Pino ロガー設定
│   └── poc-users.json          # PoC Cognito ユーザー定義（検証用）
│
├── container/
│   ├── index.ts                # Awilix DI コンテナ設定
│   └── types.ts                # コンテナ型定義（IAuditLogger は Context 型使用）
│
├── domain/
│   └── types/
│       └── auth.ts             # ドメインモデル、RBAC ロール・権限定義
│
├── adapters/
│   ├── auth/
│   │   ├── BaseAuthAdapter.ts      # 認証アダプター基底クラス
│   │   ├── DummyAuthAdapter.ts     # 開発用認証アダプター
│   │   ├── CognitoAuthAdapter.ts   # AWS Cognito 認証アダプター
│   │   └── index.ts                # エクスポート（3 アダプター全て）
│   └── blacklist/
│       ├── InMemoryBlacklist.ts    # インメモリブラックリスト
│       ├── RedisBlacklist.ts       # Redis ブラックリスト
│       └── index.ts                # エクスポート
│
├── middleware/
│   ├── auth.ts                 # 認証検証ミドルウェア
│   ├── rbac.ts                 # RBAC ミドルウェア
│   ├── auditLog.ts             # 監査ログミドルウェア
│   ├── rateLimit.ts            # レート制限ミドルウェア
│   └── index.ts                # エクスポート
│
├── routes/
│   ├── auth.ts                 # 認証エンドポイント（4 ルート）
│   └── health.ts               # ヘルスチェック（2 ルート）
│
├── services/
│   └── JwtService.ts           # JWT 生成・検証サービス
│
├── usecases/
│   ├── AuthUseCase.ts          # 認証ビジネスロジック
│   └── index.ts                # エクスポート
│
└── utils/
    ├── ip.ts                   # クライアント IP 取得（共通ユーティリティ）
    ├── token.ts                # Bearer トークン・Cookie 抽出
    └── index.ts                # エクスポート

tests/
├── setup.ts                    # Jest 環境設定
├── unit/
│   ├── app.test.ts             # API テスト
│   ├── services/
│   │   └── JwtService.test.ts
│   ├── adapters/
│   │   ├── DummyAuthAdapter.test.ts
│   │   ├── CognitoAuthAdapter.test.ts
│   │   └── blacklist/
│   │       └── InMemoryBlacklist.test.ts
│   ├── middleware/
│   │   ├── rbac.test.ts
│   │   └── auditLog.test.ts
│   └── usecases/
│       └── AuthUseCase.test.ts
└── e2e/
    └── basic.test.ts           # E2E テスト
```

---

## 実装上の前提・制約

* **認証プロバイダーの切り替え**
  * `AUTH_PROVIDER` 環境変数で切り替え（デフォルト: `cognito`）
  * 開発: `dummy`（ハードコードユーザー）
  * 本番: `cognito`（AWS Cognito）

* **トークン方式**
  * Bearer トークン（`Authorization: Bearer <token>`）
  * セッション Cookie（`session`、httpOnly、secure）
  * 両方式を同時サポート

* **トークンブラックリスト**
  * シングルインスタンス: InMemoryBlacklist（`.unref()` でプロセス終了非阻害）
  * 分散環境: RedisBlacklist（`REDIS_URL` 設定時）
  * ログアウト時にトークンを無効化

* **レート制限**
  * ログイン: 5 requests/minute per IP（RateLimitStore も `.unref()` 付き）
  * API: 100 requests/15 minutes per IP
  * テスト時（`NODE_ENV=test`）はスキップ

* **セキュリティ**
  * JWT HS256 署名
  * トークンタイプ検証（access/refresh 分離）
  * `??` (nullish coalescing) による安全なデフォルト値
  * RBAC による権限制御
  * 監査ログによるアクセス追跡

---

## デプロイ形態

### Node.js サーバー

```bash
npm run build
npm run start
```

### Docker

```dockerfile
# マルチステージビルド (node:20-alpine)
# Health check: /health
# Port: 10000 (Render デフォルト)
```

### Render (推奨)

[README-Render.md](./README-Render.md) を参照。

---

## 位置づけ

* **認証ゲートウェイ** として独立稼働
* Clean Architecture + DI パターン採用（Awilix `InjectionMode.CLASSIC`）
* プラガブルな認証アダプター（開発/本番切り替え）
* Kubernetes / Render 両対応
* セキュリティ基盤整備済み（JWT, RBAC, 監査ログ, レート制限）
* 8 テストスイート・79 テストケースによる品質保証

---

## 関連ドキュメント

* [README.md](./README.md) - 構築・運用ガイド
* [CLAUDE.md](../../CLAUDE.md) - プロジェクト全体のガイド
