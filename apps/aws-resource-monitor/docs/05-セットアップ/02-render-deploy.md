# Render デプロイ設定

Render へのデプロイに必要な環境変数とサービス設定。

---

## 環境変数一覧（Doppler 命名規則準拠）

### 基本設定

| 変数名 | 説明 | 本番推奨値 |
|--------|------|------------|
| `NODE_ENV` | Node.js 環境 | `production` |
| `ENV` | アプリ環境識別子 | `production` |
| `PROJECT_NAME` | アプリ名（ログ識別用） | `my-app` |
| `LOG_LEVEL` | ログレベル | `info` |

> `PORT` は Render が自動設定するため不要

### CORS 設定（オプション）

| 変数名 | 説明 | 備考 |
|--------|------|------|
| `CORS_ORIGINS` | 許可するオリジン（カンマ区切り） | フロントエンドが別ドメインの場合のみ必要 |

**モノリス構成（このプロジェクト）では CORS_ORIGINS は不要。**

```
# 別ドメインにフロントエンドがある場合のみ設定
CORS_ORIGINS=https://my-frontend.example.com
```

---

### DB_* データベース

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `DB_MONGODB_URI` | MongoDB 接続文字列 | ✅ |
| `DB_MONGODB_DB_NAME` | MongoDB データベース名 | ✅ |

---

### AUTH_* 認証・認可

| 変数名 | 説明 | 条件 |
|--------|------|------|
| `AUTH_ENABLED` | 認証を有効化 (`true`/`false`) | - |
| `AUTH_JWT_SECRET` | JWT 署名用シークレット | `AUTH_ENABLED=true` |
| `AUTH_CLERK_SECRET_KEY` | Clerk Secret Key | `AUTH_ENABLED=true` |
| `AUTH_CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key | `AUTH_ENABLED=true` |

---

### INTERNAL_* 内部用・運用専用

| 変数名 | 説明 | 用途 |
|--------|------|------|
| `INTERNAL_PROJECT_API_KEY` | 内部 API アクセスキー | API Key 認証 |

---

### OWNER_* 管理者定義

| 変数名 | 説明 | 備考 |
|--------|------|------|
| `OWNER_ADMIN_USER_IDS` | 管理者ユーザー ID（カンマ区切り） | 特権判定用 |

---

### AI_* AI/LLM（必要時のみ）

| 変数名 | 説明 |
|--------|------|
| `AI_OPENAI_API_KEY` | OpenAI API Key |
| `AI_ANTHROPIC_API_KEY` | Anthropic API Key |
| `AI_DEEPSEEK_API_KEY` | DeepSeek API Key |

---

## Render サービス設定

| 項目 | 値 |
|------|-----|
| **Environment** | Node |
| **Build Command** | `npm ci && npm run build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |

---

## 設定例

### 最小構成（認証なし）

```env
NODE_ENV=production
ENV=production
PROJECT_NAME=my-app
LOG_LEVEL=info

DB_MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
DB_MONGODB_DB_NAME=my-app
```

### フル構成（認証あり）

```env
NODE_ENV=production
ENV=production
PROJECT_NAME=my-app
LOG_LEVEL=info

DB_MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
DB_MONGODB_DB_NAME=my-app

AUTH_ENABLED=true
AUTH_JWT_SECRET=your-jwt-secret
AUTH_CLERK_SECRET_KEY=sk_live_...
AUTH_CLERK_PUBLISHABLE_KEY=pk_live_...

INTERNAL_PROJECT_API_KEY=your-internal-api-key
OWNER_ADMIN_USER_IDS=user_abc123,user_def456
```

---

## 関連ドキュメント

- [01-doppler.md](./01-doppler.md) - Doppler 設定
- [03-render-warmup.md](./03-render-warmup.md) - スピンダウン対策
