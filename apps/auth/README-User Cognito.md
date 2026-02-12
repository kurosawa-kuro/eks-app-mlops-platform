# Cognito User 管理ガイド

> **AWS Cognito ユーザープール管理**
> 本ドキュメントは、Cognito User Pool の設定、ユーザー管理、認証フローについて記載しています。

---

## 概要

本プロジェクトでは、認証プロバイダーとして AWS Cognito を使用できます。
Terraform ではなく CLI ベースで管理し、柔軟な運用を可能にしています。

| モード | 環境変数 | 用途 |
|--------|---------|------|
| Dummy | `AUTH_PROVIDER=dummy` | 開発・テスト（ハードコードユーザー） |
| Cognito | `AUTH_PROVIDER=cognito` | 本番（AWS Cognito） |

---

## 管理スクリプト

### 場所

```
/scripts/infra/aws/cognito-manage.ts
```

### コマンド一覧

```bash
cd /home/wsl/local_ubuntu/eks-app-mlops-platform/scripts

# User Pool 管理
npx tsx infra/aws/cognito-manage.ts list                              # 全プール一覧
npx tsx infra/aws/cognito-manage.ts show <pool-id>                    # プール詳細
npx tsx infra/aws/cognito-manage.ts create <pool-name> [--mfa]        # プール作成
npx tsx infra/aws/cognito-manage.ts delete <pool-id> [--force]        # プール削除

# ユーザー管理
npx tsx infra/aws/cognito-manage.ts users <pool-id>                   # ユーザー一覧
npx tsx infra/aws/cognito-manage.ts create-user <pool-id> <email>     # ユーザー作成

# App Client 管理
npx tsx infra/aws/cognito-manage.ts clients <pool-id>                 # クライアント一覧
npx tsx infra/aws/cognito-manage.ts create-client <pool-id> <name>    # クライアント作成

# 認証テスト
npx tsx infra/aws/cognito-manage.ts test <pool-id> <client-id> <email> <password>
```

---

## User Pool 設定

### デフォルト設定

```typescript
{
  PoolName: "<指定名>",

  // パスワードポリシー
  Policies: {
    PasswordPolicy: {
      MinimumLength: 8,
      RequireUppercase: true,
      RequireLowercase: true,
      RequireNumbers: true,
      RequireSymbols: false,
      TemporaryPasswordValidityDays: 7,
    },
  },

  // 認証設定
  AutoVerifiedAttributes: ['email'],
  UsernameAttributes: ['email'],           // メールアドレスでログイン
  MfaConfiguration: 'OFF',                 // --mfa で 'OPTIONAL' に変更可

  // ユーザー属性
  Schema: [
    { Name: 'email', AttributeDataType: 'String', Required: true, Mutable: true },
    { Name: 'name', AttributeDataType: 'String', Required: false, Mutable: true },
  ],

  // 管理者設定
  AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },

  // アカウント復旧
  AccountRecoverySetting: {
    RecoveryMechanisms: [{ Priority: 1, Name: 'verified_email' }],
  },
}
```

### App Client 設定

```typescript
{
  ClientName: "<pool-name>-client",
  GenerateSecret: false,                   // パブリッククライアント（シークレットなし）

  // 認証フロー
  ExplicitAuthFlows: [
    'ALLOW_USER_PASSWORD_AUTH',            // ユーザー名 + パスワード
    'ALLOW_USER_SRP_AUTH',                 // Secure Remote Password
    'ALLOW_REFRESH_TOKEN_AUTH',            // トークンリフレッシュ
  ],

  PreventUserExistenceErrors: 'ENABLED',   // ユーザー存在エラーを隠蔽（セキュリティ）
}
```

---

## ユーザー属性

### 標準属性

| 属性 | 必須 | 説明 |
|------|------|------|
| email | Yes | ログイン ID として使用 |
| name | No | 表示名 |

### カスタム属性

| 属性 | 用途 | デフォルト |
|------|------|-----------|
| custom:role | RBAC ロール | user |

### ロール定義

| ロール | 権限 |
|--------|------|
| admin | 全権限（admin:all, read/write/delete:users, read/write:analytics） |
| admin-read-only | 読み取り専用（read:users, read:analytics） |
| user | 読み取り権限（read:users, read:analytics） |
| guest | 権限なし |

---

## ユーザー作成

### スクリプトによる作成

```bash
npx tsx infra/aws/cognito-manage.ts create-user <pool-id> <email> [--password <pw>]
```

**動作:**
- 一時パスワードが自動生成（未指定時）
- メールは自動検証済み
- 初回ログイン時にパスワード変更が必要（`FORCE_CHANGE_PASSWORD`）

**一時パスワード形式:**
```
# 12文字のランダム + "!1Aa" サフィックス
# 例: "aBcDeFgHiJkL!1Aa"
```

### AWS CLI による永続パスワード設定

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id ap-northeast-1_xxxxx \
  --username user@example.com \
  --password "NewPassword123!" \
  --permanent
```

### ロール設定

```bash
aws cognito-idp admin-update-user-attributes \
  --user-pool-id ap-northeast-1_xxxxx \
  --username user@example.com \
  --user-attributes Name="custom:role",Value="admin"
```

---

## テストユーザー（開発用）

`AUTH_PROVIDER=dummy` 時に使用できるハードコードユーザー:

| ユーザー名 | パスワード | ロール | メール |
|-----------|----------|--------|--------|
| admin | password | admin | admin@example.com |
| user | password | user | user@example.com |

**ファイル:** `apps/auth/src/adapters/auth/DummyAuthAdapter.ts`

---

## PoC用 Cognito ユーザー

> **PoC 環境専用**
> 本番環境では強力なパスワードを使用してください。

### ユーザー一覧

| # | Email（ログインID） | パスワード | ロール | 用途 |
|---|---------------------|-----------|--------|------|
| 1 | admin@example.com | (see .env) | admin | 管理者（全権限） |
| 2 | admin-readonly@example.com | (see .env) | admin-read-only | 管理者（読み取り専用） |
| 3 | user1@example.com | (see .env) | user | デフォルトユーザー |
| 4 | user2@example.com | (see .env) | user | 一般ユーザー② |

### ログイン方式

- **認証方式**: Email + パスワード
- **ユーザー名**: 使用しない（Email がログイン ID）
- **ステータス**: 事前作成済み・認証済み（CONFIRMED）

### ユーザー情報管理ファイル

ユーザー情報は JSON ファイルで管理しています：

```
apps/auth/src/config/poc-users.json
```

このファイルには Cognito 設定とユーザー情報（パスワード含む）が記載されています。

### スクリプト

| スクリプト | 説明 |
|-----------|------|
| `scripts/setup-poc-users.sh` | ユーザー一括作成・パスワード設定 |
| `scripts/verify-poc-users.sh` | 全ユーザーのログイン検証 |

#### ユーザー作成（初回のみ）

```bash
cd /home/wsl/local_ubuntu/eks-app-mlops-platform/apps/auth

# poc-users.json から読み込んでユーザー作成
./scripts/setup-poc-users.sh
```

#### ログイン検証

```bash
cd /home/wsl/local_ubuntu/eks-app-mlops-platform/apps/auth

# 全ユーザーのログインテスト
./scripts/verify-poc-users.sh
```

**出力例:**
```
============================================
  PoC Cognito Users Verification
============================================

Configuration:
  Pool ID:   ap-northeast-1_XXXXXXXXX
  Client ID: XXXXXXXXXXXXXXXXXXXXXXXXXX
  Region:    ap-northeast-1

Users to verify: 3

[1/3] Testing: admin@example.com
  Role: admin (管理者（全権限）)
  ✓ Login successful

[2/3] Testing: default@example.com
  Role: user (デフォルトユーザー)
  ✓ Login successful

[3/3] Testing: user1@example.com
  Role: user (一般ユーザー①)
  ✓ Login successful

============================================
  Verification Summary
============================================

  Total:  3
  Passed: 3
  Failed: 0

All users verified successfully!
```

### 手動コマンド（参考）

#### ユーザー確認

```bash
POOL_ID="ap-northeast-1_XXXXXXXXX"

# ユーザー一覧表示
cd /home/wsl/local_ubuntu/eks-app-mlops-platform/scripts
npx tsx infra/aws/cognito-manage.ts users $POOL_ID

# 個別ユーザー確認
aws cognito-idp admin-get-user --user-pool-id $POOL_ID --username admin@example.com
```

#### 認証テスト

```bash
POOL_ID="ap-northeast-1_XXXXXXXXX"
CLIENT_ID="XXXXXXXXXXXXXXXXXXXXXXXXXX"

cd /home/wsl/local_ubuntu/eks-app-mlops-platform/scripts
npx tsx infra/aws/cognito-manage.ts test $POOL_ID $CLIENT_ID admin@example.com "(see .env)"
```

### curl でのログインテスト

```bash
# Auth Service 経由でログイン（AUTH_PROVIDER=cognito 設定時）
curl -X POST http://localhost:38002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin@example.com", "password": "(see .env)"}'
```

---

## 環境変数

### Auth Service 設定

```bash
# 認証プロバイダー切り替え
AUTH_PROVIDER=cognito              # 'dummy' または 'cognito'

# Cognito 設定（AUTH_PROVIDER=cognito 時に必須）
COGNITO_USER_POOL_ID=ap-northeast-1_xxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxx
COGNITO_REGION=ap-northeast-1

# トークン有効期限
ACCESS_TOKEN_TTL=3600              # アクセストークン（秒）デフォルト: 1時間
REFRESH_TOKEN_TTL=604800           # リフレッシュトークン（秒）デフォルト: 7日

# JWT 署名キー（Dummy モード用）
JWT_SECRET=your-secret-key-32-characters
```

### 現在の開発環境設定例

```bash
PORT=38002
NODE_ENV=development
AUTH_PROVIDER=dummy
JWT_SECRET=your-jwt-secret-change-me-32chars-min!
COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
COGNITO_REGION=ap-northeast-1
```

---

## 認証フロー

### ログイン

```
POST /auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "Password123!"
}
```

**レスポンス:**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "eyJjdHkiOiJKV1QiLCJl...",
  "user": {
    "id": "12345678-1234-1234-1234-123456789012",
    "username": "user@example.com",
    "role": "admin"
  }
}
```

### ユーザー情報取得

```
GET /auth/me
Authorization: Bearer <accessToken>
```

**レスポンス:**
```json
{
  "user": {
    "id": "12345678-1234-1234-1234-123456789012",
    "username": "user@example.com",
    "role": "admin"
  }
}
```

### トークンリフレッシュ

```
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJjdHkiOiJKV1QiLCJl..."
}
```

### ログアウト

```
POST /auth/logout
Authorization: Bearer <accessToken>
```

---

## Cognito Adapter 実装

### ファイル

```
apps/auth/src/adapters/auth/CognitoAuthAdapter.ts
```

### 機能

| 機能 | 説明 |
|------|------|
| login() | USER_PASSWORD_AUTH フローでログイン |
| verifyToken() | JWKS を使用したトークン検証 |
| refreshToken() | REFRESH_TOKEN_AUTH フローでリフレッシュ |
| logout() | GlobalSignOut + ローカルブラックリスト |

### JWKS 検証

```typescript
// JWKS URL
https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json

// トークン検証
const JWKS = createRemoteJWKSet(new URL(jwksUrl))
const { payload } = await jwtVerify(token, JWKS)

// ロール抽出
const role = payload['custom:role'] || 'user'
```

### エラーハンドリング

| Cognito エラー | 対応 |
|---------------|------|
| NotAuthorizedException | 認証失敗（無効な資格情報） |
| UserNotFoundException | ユーザーが存在しない |
| UserNotConfirmedException | ユーザー未確認 |
| PasswordResetRequiredException | パスワードリセットが必要 |

---

## Monolith 連携

### トークン検証委譲

Monolith アプリは Auth Service に検証を委譲できます:

```typescript
// apps/monolith/src/services/AuthServiceClient.ts

async verifyToken(token: string): Promise<AuthPayload | null> {
  const response = await fetch(`${this.baseUrl}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.json()
}
```

### 環境変数

```bash
# Monolith 側の設定
AUTH_SERVICE_URL=http://auth-service:38002
```

---

## Lambda デプロイ

### Terraform 設定

```
infra/terraform/prod/91_lambda_auth.tf
```

| 設定 | 値 |
|------|-----|
| ランタイム | Node.js 20.x |
| メモリ | 512 MB |
| タイムアウト | 30 秒 |
| ハンドラー | src/lambda-handler.handler |
| ALB ルーティング | /auth/* → Lambda |

### ビルド

```bash
cd apps/auth
npm run build:lambda
```

---

## セキュリティ考慮事項

### パスワードポリシー

- 最小 8 文字
- 大文字・小文字・数字必須
- 記号はオプション

### トークンブラックリスト

| 環境 | アダプター | 説明 |
|------|----------|------|
| 開発 | InMemoryBlacklist | 単一インスタンス用 |
| 本番 | RedisBlacklist | 分散環境用（K8s） |

### レート制限

| エンドポイント | 制限 |
|---------------|------|
| /auth/login | 5 req/min per IP |
| その他 API | 100 req/15min per IP |

---

## トラブルシューティング

### よくある問題

**1. FORCE_CHANGE_PASSWORD エラー**
```bash
# 永続パスワードを設定
aws cognito-idp admin-set-user-password \
  --user-pool-id <pool-id> \
  --username <email> \
  --password "NewPassword123!" \
  --permanent
```

**2. custom:role が取得できない**
```bash
# ユーザー属性を確認
aws cognito-idp admin-get-user \
  --user-pool-id <pool-id> \
  --username <email>

# ロールを設定
aws cognito-idp admin-update-user-attributes \
  --user-pool-id <pool-id> \
  --username <email> \
  --user-attributes Name="custom:role",Value="admin"
```

**3. トークン検証失敗**
- JWKS URL が正しいか確認
- リージョンとプール ID が一致しているか確認
- トークンが期限切れでないか確認

---

## 関連ファイル

| ファイル | 説明 |
|---------|------|
| `scripts/infra/aws/cognito-manage.ts` | Cognito 管理 CLI |
| `apps/auth/src/adapters/auth/CognitoAuthAdapter.ts` | Cognito 連携実装 |
| `apps/auth/src/adapters/auth/DummyAuthAdapter.ts` | 開発用テストユーザー |
| `apps/auth/src/config/env.ts` | 環境変数スキーマ |
| `apps/auth/src/domain/types/auth.ts` | RBAC ロール・権限定義 |
| `apps/monolith/src/services/AuthServiceClient.ts` | Monolith 連携クライアント |
| `infra/terraform/prod/91_lambda_auth.tf` | Lambda デプロイ設定 |

---

## 関連ドキュメント

* [README.md](./README.md) - 構築・運用ガイド
* [README-実装状況.md](./README-実装状況.md) - Auth Service 実装詳細
