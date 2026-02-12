# Auth API - Render デプロイガイド

Render へのデプロイ手順と運用情報。Docker と非 Docker の両方の方法をサポート。

## 現在のデプロイ情報

| 項目 | 値 |
|------|-----|
| **URL** | https://your-auth-gateway.example.com |
| **AUTH_PROVIDER** | `dummy` |
| **デプロイ日** | 2025-12-19 |
| **ステータス** | 稼働中 |

---

## 前提条件

- [Render](https://render.com/) アカウント
- GitHub/GitLab リポジトリ

---

## デプロイ方法

### 方法 1: Docker を使用（推奨）

Docker を使用することで、ローカルと本番環境の一貫性を保証できます。

#### 1. Dockerfile の確認

リポジトリに `Dockerfile` が含まれていることを確認。

#### 2. Render Dashboard で Web Service を作成

1. [Render Dashboard](https://dashboard.render.com/) にログイン
2. **New** → **Web Service** をクリック
3. GitHub/GitLab リポジトリを接続
4. 以下の設定を入力:

| 項目 | 値 |
|------|-----|
| **Name** | `auth-api` |
| **Region** | お好みのリージョン |
| **Root Directory** | `apps/auth` |
| **Environment** | `Docker` |

5. **Advanced** → **Add Environment Variable** で環境変数を設定（下記参照）
6. **Create Web Service** をクリック

---

### 方法 2: Native Node.js

Docker を使用せず、Render のネイティブ Node.js ランタイムを使用。

#### Render Dashboard で Web Service を作成

1. [Render Dashboard](https://dashboard.render.com/) にログイン
2. **New** → **Web Service** をクリック
3. GitHub/GitLab リポジトリを接続
4. 以下の設定を入力:

| 項目 | 値 |
|------|-----|
| **Name** | `auth-api` |
| **Region** | お好みのリージョン |
| **Root Directory** | `apps/auth` |
| **Environment** | `Node` |
| **Build Command** | `npm ci && npm run build` |
| **Start Command** | `node dist/index.js` |

5. **Advanced** → **Add Environment Variable** で環境変数を設定（下記参照）
6. **Create Web Service** をクリック

---

## 環境変数

Render Dashboard の **Environment** タブで設定。

### 必須

| 変数 | 値 | 説明 |
|------|-----|------|
| `NODE_ENV` | `production` | 本番環境フラグ |
| `AUTH_PROVIDER` | `dummy` または `cognito` | 認証プロバイダー |

### Cognito 使用時（AUTH_PROVIDER=cognito）

| 変数 | 値 | 説明 |
|------|-----|------|
| `COGNITO_USER_POOL_ID` | `ap-northeast-1_xxxxxxxxx` | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | `xxxxxxxxxxxxxxxxxxxxxxxxxx` | Cognito App Client ID |
| `COGNITO_REGION` | `ap-northeast-1` | AWS リージョン |

### ダミー認証使用時（AUTH_PROVIDER=dummy）

| 変数 | 値 | 説明 |
|------|-----|------|
| `JWT_SECRET` | `your-secure-secret-key` | JWT 署名キー（本番環境では強力な値を使用） |

### オプション

| 変数 | デフォルト | 説明 |
|------|----------|------|
| `PORT` | `10000`（Render デフォルト） | サーバーポート（通常は設定不要） |
| `ACCESS_TOKEN_TTL` | `3600` | Access Token 有効期限（秒） |
| `REFRESH_TOKEN_TTL` | `604800` | Refresh Token 有効期限（秒） |
| `REDIS_URL` | - | Redis 接続 URL（分散ブラックリスト用） |

**注意**: `PORT` は Render が自動的に設定するため、通常は設定不要です。

---

## render.yaml（Infrastructure as Code）

リポジトリに `render.yaml` を配置することで、設定をコード管理できます。

### Docker 版

```yaml
services:
  - type: web
    name: auth-api
    runtime: docker
    rootDir: apps/auth
    dockerfilePath: ./Dockerfile
    envVars:
      - key: NODE_ENV
        value: production
      - key: AUTH_PROVIDER
        value: dummy
      - key: JWT_SECRET
        sync: false  # Render Dashboard で設定
    healthCheckPath: /health
```

### Native Node.js 版

```yaml
services:
  - type: web
    name: auth-api
    runtime: node
    rootDir: apps/auth
    buildCommand: npm ci && npm run build
    startCommand: node dist/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: AUTH_PROVIDER
        value: dummy
      - key: JWT_SECRET
        sync: false  # Render Dashboard で設定
    healthCheckPath: /health
```

---

## API エンドポイント

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/health` | ヘルスチェック | 不要 |
| GET | `/health/status` | ステータス確認 | 不要 |
| POST | `/auth/login` | ログイン | 不要 |
| GET | `/auth/me` | ユーザー情報取得 | 任意 |
| POST | `/auth/refresh` | トークンリフレッシュ | 不要 |
| POST | `/auth/logout` | ログアウト | 任意 |

---

## 動作検証

### テストユーザー（Dummy 認証）

| ユーザー名 | パスワード | ロール |
|-----------|----------|--------|
| `admin` | `password` | admin |
| `user` | `password` | user |
| `viewer` | `password` | viewer |

### ヘルスチェック

```bash
curl https://your-auth-gateway.example.com/health
```

**レスポンス:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-19T01:57:15.964Z",
  "uptime": 227.068749078
}
```

### ログイン

```bash
curl -X POST https://your-auth-gateway.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

**レスポンス:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### ユーザー情報取得 (/auth/me)

**認証あり:**
```bash
curl https://your-auth-gateway.example.com/auth/me \
  -H "Authorization: Bearer <access_token>"
```

**レスポンス:**
```json
{
  "authenticated": true,
  "user": {
    "sub": "dummy-admin-id",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

**認証なし:**
```json
{
  "authenticated": false
}
```

### トークンリフレッシュ

```bash
curl -X POST https://your-auth-gateway.example.com/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<refresh_token>"}'
```

**レスポンス:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### ログアウト

```bash
curl -X POST https://your-auth-gateway.example.com/auth/logout \
  -H "Authorization: Bearer <access_token>"
```

**レスポンス:**
```json
{
  "message": "logged out"
}
```

**注意:** ログアウト後、そのトークンはブラックリストに追加され、以降の認証は失敗します。

---

## 注意事項

### Render Free Tier の制限

- **スリープ**: 15分間アクセスがないとサービスがスリープ
- **起動時間**: スリープからの復帰に数十秒かかる場合あり
- **月間稼働時間**: 750時間/月

### セキュリティ

- **本番環境では `AUTH_PROVIDER=cognito` を推奨**
- ダミー認証は開発・テスト用途のみ
- 機密情報は Render Dashboard の Environment Variables で管理（リポジトリにコミットしない）

### パフォーマンス

- Render は自動スケーリングをサポート（有料プラン）
- 分散環境では `REDIS_URL` を設定してトークンブラックリストを共有

---

## トラブルシューティング

### ビルドが失敗する

1. **Node.js バージョン確認**: `engines` フィールドを `package.json` に追加
   ```json
   {
     "engines": {
       "node": ">=20.0.0"
     }
   }
   ```

2. **依存関係の問題**: `npm ci` が失敗する場合は `npm install` を試す

### サービスが起動しない

1. **ログ確認**: Render Dashboard → Logs タブ
2. **PORT バインド**: アプリが `process.env.PORT` を使用しているか確認
3. **環境変数**: 必須の環境変数が設定されているか確認

### ヘルスチェックが失敗する

1. `/health` エンドポイントが正常に動作するか確認
2. 起動に時間がかかる場合は、Health Check Grace Period を延長

---

## 参考リンク

- [Render Docs - Deploy a Node Express App](https://render.com/docs/deploy-node-express-app)
- [Render Docs - Environment Variables](https://render.com/docs/configure-environment-variables)
- [Render Docs - Web Services](https://render.com/docs/web-services)
