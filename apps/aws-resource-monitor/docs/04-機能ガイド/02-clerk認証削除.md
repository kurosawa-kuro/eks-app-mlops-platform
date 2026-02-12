# Clerk 認証機能の削除手順

Clerk 認証が不要な場合、以下の手順で完全に削除できます。

## クイック削除（5ステップ）

### 1. パッケージ削除

```bash
npm uninstall @clerk/backend @hono/clerk-auth
```

### 2. ファイル削除

```bash
# 認証ミドルウェア
rm src/presentation/middleware/auth.ts

# 認証ルート
rm -rf src/presentation/routes/auth/

# ログインページ
rm -rf src/presentation/views/auth/
```

### 3. env/schema.ts から削除

```diff
  export const appConfigSchema = z.object({
    // ... 他の設定 ...
-   useAuth: z.coerce.boolean().default(false),
    // Secret
-   clerkSecretKey: z.string().default(''),
-   clerkPublishableKey: z.string().default(''),
-   ownerUserId: z.string().default(''),
  })
```

### 4. env/loader.ts から削除

```diff
  function loadFromEnv(): Record<string, unknown> {
    return {
      // ... 他の設定 ...
-     useAuth: process.env.USE_AUTH,
-     clerkSecretKey: process.env.CLERK_SECRET_KEY,
-     clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY,
-     ownerUserId: process.env.OWNER_USER_ID,
    }
  }
```

### 5. routes/index.ts から削除

```diff
- // AUTH FEATURE: 認証ミドルウェア
- import { createAuthMiddleware, createRequireAuthMiddleware, createOwnerOnlyMiddleware } from '../middleware/auth.js'

- // AUTH FEATURE: 認証ルート
- import { createAuthRoutes } from './auth/index.js'

  export function createRoutes(container: AwilixContainer<Cradle>, appConfig: AppConfig) {
    // ...

-   // AUTH FEATURE: 認証ミドルウェア
-   const authMiddleware = createAuthMiddleware(appConfig)
-   const requireAuth = createRequireAuthMiddleware(appConfig)
-   const ownerOnly = createOwnerOnlyMiddleware(appConfig)

    // Route dependencies
    const deps: RouteDeps = {
      container,
      appConfig,
      apiKeyAuth,
-     // AUTH FEATURE
-     authMiddleware,
-     requireAuth,
    }

-   // AUTH FEATURE: 認証ルート
-   app.use('/auth/*', authMiddleware)
-   app.route('/auth', createAuthRoutes(deps))

-   // AUTH FEATURE: 保護ルートに認証ミドルウェアを適用
-   app.use('/dashboard', authMiddleware, ownerOnly)
-   app.use('/dashboard/*', authMiddleware, ownerOnly)
-   // ... 他のルートも同様に削除 ...

    // Pages (ミドルウェアなしで直接マウント)
    app.route('/dashboard', createDashboardRoutes(deps))
    // ...
  }
```

### 6. routes/types.ts から削除

```diff
  export interface RouteDeps {
    container: AwilixContainer<Cradle>
    appConfig: AppConfig
    apiKeyAuth: MiddlewareHandler
-   // AUTH FEATURE
-   authMiddleware: MiddlewareHandler
-   requireAuth: MiddlewareHandler
  }
```

### 7. helpers/render.ts から削除

```diff
- import { getAuth } from '@hono/clerk-auth'

  export async function render(c: Context, template: string, data: RenderOptions = {}): Promise<Response> {
    // ...

-   // AUTH FEATURE: 認証情報を全テンプレートに自動注入
-   const auth = appConfig.useAuth ? getAuth(c) : null
-   const authConfig = {
-     useAuth: appConfig.useAuth,
-     clerkPublishableKey: appConfig.useAuth ? appConfig.clerkPublishableKey : '',
-     user: auth ? {
-       id: auth.userId,
-       sessionId: auth.sessionId,
-       orgId: auth.orgId,
-     } : null
-   }

    const templatePath = path.join(viewsDir, `${template}.ejs`)
-   const body = await ejs.renderFile(templatePath, { ...viewData, apiKeyConfig, authConfig })
+   const body = await ejs.renderFile(templatePath, { ...viewData, apiKeyConfig })

    if (layout) {
      const layoutPath = path.join(layoutsDir, `${layout}.ejs`)
      const html = await ejs.renderFile(layoutPath, {
        ...viewData,
        apiKeyConfig,
-       authConfig,
        body
      })
      // ...
    }
  }
```

### 8. views/layouts/main.ejs から削除

以下のブロックを削除：

```ejs
<!-- 削除: Clerk SDK 読み込み (約 800-810 行目) -->
<% if (authConfig?.useAuth) { %>
<!-- AUTH FEATURE: Clerk JavaScript SDK -->
...
<% } %>

<!-- 削除: UserButton 表示 (約 948-985 行目) -->
<% if (authConfig?.useAuth) { %>
<!-- AUTH FEATURE: Clerk UserButton or Login -->
...
<% } %>

<!-- 削除: Clerk 初期化スクリプト (約 990-1010 行目) -->
<% if (authConfig?.useAuth) { %>
<!-- AUTH FEATURE: Clerk initialization -->
...
<% } %>
```

### 9. 環境変数を削除

```bash
# Doppler
doppler secrets delete USE_AUTH CLERK_SECRET_KEY CLERK_PUBLISHABLE_KEY OWNER_USER_ID --config dev

# .env の場合は手動で削除
```

## 確認

```bash
# ビルドが通ることを確認
npm run build

# 起動確認
npm run dev
```

## 削除対象ファイル一覧

| ファイル | 操作 |
|----------|------|
| `src/presentation/middleware/auth.ts` | 削除 |
| `src/presentation/routes/auth/` | ディレクトリ削除 |
| `src/presentation/views/auth/` | ディレクトリ削除 |
| `src/env/schema.ts` | 編集（4項目削除） |
| `src/env/loader.ts` | 編集（4項目削除） |
| `src/presentation/routes/index.ts` | 編集（import・ミドルウェア削除） |
| `src/presentation/routes/types.ts` | 編集（2項目削除） |
| `src/presentation/helpers/render.ts` | 編集（authConfig削除） |
| `src/presentation/views/layouts/main.ejs` | 編集（3ブロック削除） |

## 注意

- `AUTH FEATURE:` コメントで該当箇所をマークしています
- grep で確認: `grep -r "AUTH FEATURE" src/`
- grep で確認: `grep -r "clerk\|Clerk\|authConfig" src/`
