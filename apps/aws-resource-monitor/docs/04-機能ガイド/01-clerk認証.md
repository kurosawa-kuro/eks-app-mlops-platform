# Clerk 認証機能

## 概要

このスターターキットには [Clerk](https://clerk.com/) による認証機能が組み込まれています。
`USE_AUTH=true` で有効化すると、ログイン/ログアウト機能が利用可能になります。

## セットアップ

### 1. Clerk アカウント作成

1. [Clerk Dashboard](https://dashboard.clerk.com/) でアカウント作成
2. 新しいアプリケーションを作成
3. 認証方法を選択（Email, Google, GitHub など）

### 2. API キーの取得

Clerk Dashboard → API Keys から以下を取得：

| キー | 説明 |
|------|------|
| `CLERK_PUBLISHABLE_KEY` | フロントエンド用（`pk_test_...` or `pk_live_...`） |
| `CLERK_SECRET_KEY` | バックエンド用（`sk_test_...` or `sk_live_...`） |

### 3. 環境変数の設定

```bash
# Doppler
doppler secrets set CLERK_PUBLISHABLE_KEY=pk_test_xxx --config dev
doppler secrets set CLERK_SECRET_KEY=sk_test_xxx --config dev
doppler secrets set USE_AUTH=true --config dev

# または .env
CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
USE_AUTH=true
```

### 4. オーナー限定アクセス（オプション）

特定ユーザーのみアクセスを許可する場合：

1. Clerk Dashboard → Users → 自分のユーザー → User ID をコピー
   - 形式: `user_2abcXYZ...`

2. 環境変数に設定:
```bash
OWNER_USER_ID=user_xxxxx
```

設定すると、そのユーザー以外は 403 Forbidden になります。

## 機能一覧

### ルート

| パス | 説明 |
|------|------|
| `/auth/login` | ログインページ（Clerk UI） |
| `/auth/status` | 認証ステータス API |
| `/auth/me` | 現在のユーザー情報 API |

### ミドルウェア

| 関数 | 説明 |
|------|------|
| `createAuthMiddleware` | Clerk セッション検証 |
| `createRequireAuthMiddleware` | 認証必須（未認証→ログインへリダイレクト） |
| `createAuthorizeMiddleware` | ロールベースのアクセス制御 |

### ヘルパー

| 関数 | 説明 |
|------|------|
| `getCurrentAuth(c, config)` | 認証情報を取得 |
| `getCurrentUserId(c, config)` | ユーザーID を取得 |
| `getAuth(c)` | @hono/clerk-auth の関数（直接利用） |

## ファイル構成

```
src/
├── env/
│   ├── schema.ts          # useAuth, clerkSecretKey, clerkPublishableKey, ownerUserId
│   └── loader.ts          # 環境変数読み込み
├── presentation/
│   ├── middleware/
│   │   └── auth.ts        # 認証ミドルウェア
│   ├── routes/
│   │   ├── auth/
│   │   │   └── index.ts   # /auth/* ルート
│   │   └── index.ts       # ミドルウェア適用
│   ├── views/
│   │   ├── auth/
│   │   │   └── login.ejs  # ログインページ
│   │   └── layouts/
│   │       └── main.ejs   # UserButton 表示
│   └── helpers/
│       └── render.ts      # authConfig 注入
```

## 使用例

### コントローラーで認証情報を使う

```typescript
import { getAuth } from '@hono/clerk-auth'

app.get('/api/profile', (c) => {
  const auth = getAuth(c)

  if (!auth?.userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json({
    userId: auth.userId,
    sessionId: auth.sessionId,
  })
})
```

### ビューで認証状態を表示

```ejs
<% if (authConfig?.user) { %>
  <p>ログイン中: <%= authConfig.user.id %></p>
<% } else { %>
  <a href="/auth/login">ログイン</a>
<% } %>
```

## USE_AUTH=false の動作

認証を無効にすると：
- 全ミドルウェアがパススルー
- `/auth/login` は `/dashboard` へリダイレクト
- `authConfig.user` は常に `null`
- 全ページにアクセス可能

## 依存パッケージ

```json
{
  "@clerk/backend": "^2.29.0",
  "@hono/clerk-auth": "^3.0.3"
}
```

## 参考リンク

- [Clerk Docs](https://clerk.com/docs)
- [Hono Clerk Auth](https://github.com/honojs/middleware/tree/main/packages/clerk-auth)
- [Clerk Dashboard](https://dashboard.clerk.com/)
