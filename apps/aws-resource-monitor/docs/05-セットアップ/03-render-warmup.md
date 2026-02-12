# Render Warm-up 設定

Render（無料プラン）のスピンダウン対策として、GitHub Actions の cron で定期的に HTTP ping を送る設定。

## 概要

- Render無料プランは一定時間アクセスが無いとスリープし、コールドスタートが発生する
- アプリ内部の cron は寝たら動かないため、外部から叩く必要がある
- **12分間隔**で ping することでスリープを防止

---

## セットアップ手順

### Step 1: ワークフローファイルを配置

サンプルファイルをコピー:

```bash
cp workflows-sample/render-warmup.yml-sample .github/workflows/render-warmup.yml
```

### Step 2: GitHub Secrets を設定

GitHub → リポジトリ → Settings → Secrets and variables → Actions

| Secret名 | 設定値 |
|----------|--------|
| `WARMUP_URL` | `https://<your-app>.onrender.com/api/health` |

### Step 3: Render 側で Health Check を設定（推奨）

Render Dashboard → サービス → Settings

| 項目 | 値 |
|------|-----|
| Health Check Path | `/api/health` |

### Step 4: 動作確認

GitHub Actions タブ → **Render Warm Up** → **Run workflow** で手動実行

---

## 設定内容の説明

### Health エンドポイント

**エンドポイント**: `GET /api/health`

```ts
// レスポンス
{ "status": "ok" }
```

- DB接続不要の軽量エンドポイント
- CORS対応済み

### GitHub Actions ワークフロー

**ファイル**: `.github/workflows/render-warmup.yml`

- 12分おきに `WARMUP_URL` へ HTTP ping を送信
- `workflow_dispatch` で手動実行も可能

---

## トラブルシューティング

### 503 が出る場合

1. Render Dashboard → Logs を確認
2. Build/Start コマンド、PORT 設定を確認
3. `curl -f` により Actions が失敗として記録されるので気づける

---

## 参考リンク

- [Render Health Checks](https://render.com/docs/health-checks)
- [GitHub Actions schedule](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
