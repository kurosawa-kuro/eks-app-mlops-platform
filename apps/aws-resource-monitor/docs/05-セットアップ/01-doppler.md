了解です。
**現在の Doppler（`kuro-dev-k / dev`）に登録されている Secrets（Active 15）を正とし、ドキュメント全文を整合する形で修正**します。

ポイントは以下です：

* ❌ **存在しないキーを全削除**（`NODE_ENV`, `PORT`, 旧 API 名、旧 DB 名など）
* ✅ **新しい正規化後キーに完全一致**
* ✅ `dev_personal` → **実態どおり `dev` に修正**
* ✅ `env.ts` も **そのまま使える形**に更新

---

# Doppler × Hono 連携サンプルドキュメント（実運用前提・最新版）

## 1. 目的

本ドキュメントは、**Hono（Node / Bun / Deno）アプリケーション**において
**Doppler を用いた環境変数（Secrets）管理**を行うための、
**最小かつ実運用に耐える構成例**を示す。

* `.env` をリポジトリに置かない
* 環境差分（dev / staging / prod）は **Doppler 側で管理**
* アプリは **process.env を読むだけ**
* Secrets の登録・編集は **Doppler Web UI のみで行う**

---

## 2. 全体構成

```
┌────────────┐
│ Doppler    │
│  - secrets │  ← Web UIで管理
│  - config  │
└─────┬──────┘
      │ doppler run
┌─────▼─────────────────┐
│ Hono Application       │
│  - process.env         │
│  - hono routes         │
└───────────────────────┘
```

---

## 3. 前提条件

* Node.js 18+ / Bun / Deno
* Hono 導入済み
* Doppler CLI インストール済み
  ※ **Secrets 登録用途では使用しない**

```bash
brew install dopplerhq/cli/doppler
# or (Ubuntu / WSL)
curl -Ls https://cli.doppler.com/install.sh | sudo sh
```

確認：

```bash
doppler --version
# v3.x.x
```

---

## 4. Doppler 側セットアップ

### 4.1 プロジェクト / Config 紐付け（CLI）

Doppler CLI は **Secrets を登録するためのツールではない**。
本プロジェクトでは以下の用途に限定する。

* project / config の紐付け
* Secrets の注入
* 注入状態の確認

```bash
doppler login
doppler setup
# project : kuro-dev-k
# config  : dev
```

#### 実際の紐付け状態（例）

```bash
doppler configure
```

| NAME    | VALUE      | SCOPE                                            |
| ------- | ---------- | ------------------------------------------------ |
| project | kuro-dev-k | /home/ubuntu/repos/starter-kit/main/hono/backend |
| config  | dev        | /home/ubuntu/repos/starter-kit/main/hono/backend |

---

## 5. Secrets 管理方針（重要）

* Secrets は **すべて Doppler Web UI（Dashboard）で管理**
* CLI での `doppler secrets set` は **使用しない**
* `.env` / `.env.example` は **作成しない**

---

## 6. Web UI に登録済み Secrets（実態反映）

以下は **現在の Active (15) Secrets と完全一致**する。

### API / External Services

* `API_OPENAI_API_KEY`
* `API_ANTHROPIC_API_KEY`
* `API_DEEPSEEK_API_KEY`
* `API_DISCORD_BOT_TOKEN`
* `API_GITHUB_ACCESS_TOKEN`
* `API_KAGGLE_TOKEN`

### Databases

* `DB_NEON_URI`
* `DB_MONGODB_URI`

### Cloud / Infra

* `AWS_ACCESS_KEY_ID`
* `AWS_SECRET_ACCESS_KEY`
* `CLOUDINARY_CLOUD_NAME`
* `CLOUDINARY_API_KEY`
* `CLOUDINARY_API_SECRET`

### Internal（用途別に分離）

* `INTERNAL_DEPLOY_SSH_PRIVATE_KEY`
* `INTERNAL_GIT_SSH_PRIVATE_KEY`

> Secrets の追加・変更・ローテーションは **すべて Web UI で実施**する。

### 本プロジェクト（Hono Backend）で使用

| Doppler Key | 用途 | 必須 |
|-------------|------|------|
| DB_MONGODB_URI | MongoDB接続文字列 | ✅ |
| JWT_SECRET | JWT署名用シークレット | ✅ |
| PROJECT_API_KEY | API認証キー | ✅ |
| DB_MONGODB_DB_NAME | DB名（非機密だがDopplerで管理可） | - |
| PROJECT_NAME | プロジェクト名 | - |

> `JWT_SECRET` は将来拡張用

---

## 7. CLI で行うのは「参照確認のみ」

```bash
# project / config の確認
doppler configure

# Secrets 名のみ確認（値は表示しない）
doppler secrets --only-names
```

---

## 8. Hono 側実装

### 8.1 ディレクトリ構成

```
.
├─ src/
│  ├─ index.ts
│  └─ env.ts
├─ package.json
└─ tsconfig.json
```

---

### 8.2 環境変数ラッパー（必須）

#### `src/env.ts`（実態準拠）

```ts
export const env = {
  // LLM / API
  OPENAI_API_KEY: process.env.API_OPENAI_API_KEY!,
  ANTHROPIC_API_KEY: process.env.API_ANTHROPIC_API_KEY!,
  DEEPSEEK_API_KEY: process.env.API_DEEPSEEK_API_KEY!,

  // External Services
  DISCORD_BOT_TOKEN: process.env.API_DISCORD_BOT_TOKEN!,
  GITHUB_ACCESS_TOKEN: process.env.API_GITHUB_ACCESS_TOKEN!,
  KAGGLE_API_TOKEN: process.env.API_KAGGLE_TOKEN!,

  // Databases
  NEON_POSTGRES_URI: process.env.DB_NEON_URI!,
  MONGODB_URI: process.env.DB_MONGODB_URI!,

  // Cloud
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,

  CLOUDINARY: {
    NAME: process.env.CLOUDINARY_CLOUD_NAME!,
    API_KEY: process.env.CLOUDINARY_API_KEY!,
    API_SECRET: process.env.CLOUDINARY_API_SECRET!,
  },

  // Internal
  DEPLOY_SSH_PRIVATE_KEY: process.env.INTERNAL_DEPLOY_SSH_PRIVATE_KEY!,
  GIT_SSH_PRIVATE_KEY: process.env.INTERNAL_GIT_SSH_PRIVATE_KEY!,
} as const;
```

### 設計ポイント

* `process.env` 参照は **env.ts に完全集約**
* Secrets の意味解釈は行わない
* そのまま CI/CD・Cloud Run・ECS に流用可能

---

### 8.3 Hono エントリーポイント

```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { env } from "./env";

const app = new Hono();

app.get("/", (c) =>
  c.json({
    status: "ok",
  })
);

serve({
  fetch: app.fetch,
  port: 3000, // ポートは実行環境側で制御
});
```

---

## 9. 起動方法

```bash
doppler run -- npm run dev
# or
doppler run -- node dist/index.js
```

➡ Web UI に登録済み Secrets が `process.env` に自動注入される。

---

## 10. 環境切り替え

```bash
doppler setup --config dev
doppler setup --config staging
doppler setup --config prod
```

* 環境差分は **Doppler の config のみ**
* アプリコードは一切変更しない

---

## 11. セキュリティ・設計指針

### やらなくていいこと

* `.env` 管理
* Secrets のコード直書き
* アプリ側での独自暗号化

### 注意事項

* `INTERNAL_*_SSH_PRIVATE_KEY` のログ出力は禁止
* `process.env` の dump は厳禁

---

## 12. CI/CD（簡易例）

```bash
doppler run --config prod -- npm run start
```

---

## 13. まとめ

* **Doppler Web UI = Secrets 管理の唯一の場所**
* **CLI = 紐付け・注入・確認のみ**
* **Hono = process.env を読むだけ**
* **実態とドキュメントが完全一致**

> この構成は
> **個人利用 / PoC / 小規模本番**すべてに耐える。