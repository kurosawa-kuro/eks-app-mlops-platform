import { test, expect } from '@playwright/test'

test.describe('トップページ', () => {
  test('基本要素が正しく表示される', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Hono App')
    await expect(page.locator('h1')).toContainText('Welcome to Hono!')
  })

  test('NODE_ENVが表示される', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('NODE_ENV:')).toBeVisible()
  })

  test('データベース接続テストボタンが表示される', async ({ page }) => {
    await page.goto('/')

    const postgresBtn = page.locator('#btn-postgres')

    await expect(postgresBtn).toBeVisible()
    await expect(postgresBtn).toHaveText('PostgreSQL Test')
  })

  test('セクション見出しが正しく表示される', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Database Connection Test' })).toBeVisible()
  })
})

test.describe('ヘルスチェック', () => {
  test('/health APIがJSON形式で返す', async ({ request }) => {
    const response = await request.get('/health')

    expect(response.ok()).toBeTruthy()
    expect(response.headers()['content-type']).toContain('application/json')

    const data = await response.json()
    expect(data).toHaveProperty('status', 'ok')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('uptime')
  })

  test('/health/status APIがJSON形式で返す', async ({ request }) => {
    const response = await request.get('/health/status')

    expect(response.ok()).toBeTruthy()
    expect(response.headers()['content-type']).toContain('application/json')

    const data = await response.json()
    expect(data).toHaveProperty('status', 'ok')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('uptime')
    expect(typeof data.uptime).toBe('number')
  })
})

test.describe('データベース接続テスト UI', () => {
  test('PostgreSQLボタンクリックで結果が表示される', async ({ page }) => {
    await page.goto('/')

    // 初期状態では結果エリアは非表示
    const resultEl = page.locator('#result')
    await expect(resultEl).toBeHidden()

    // ボタンをクリック
    await page.locator('#btn-postgres').click()

    // 結果エリアが表示される
    await expect(resultEl).toBeVisible()

    // 結果テキストが表示される（成功または失敗のメッセージ）
    const resultText = page.locator('#result-text')
    await expect(resultText).not.toBeEmpty()
  })
})

test.describe('レスポンシブデザイン', () => {
  test('モバイル表示で正しくレンダリングされる', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('#btn-postgres')).toBeVisible()
  })

  test('タブレット表示で正しくレンダリングされる', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')

    await expect(page.locator('h1')).toBeVisible()
  })

  test('デスクトップ表示で正しくレンダリングされる', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

    await expect(page.locator('h1')).toBeVisible()
  })
})

test.describe('ナビゲーション', () => {
  test('トップページからヘルスチェックAPIへの遷移', async ({ request }) => {
    const homeResponse = await request.get('/')
    expect(homeResponse.ok()).toBeTruthy()

    const healthResponse = await request.get('/health')
    expect(healthResponse.ok()).toBeTruthy()
    const data = await healthResponse.json()
    expect(data).toHaveProperty('status', 'ok')
  })
})

test.describe('APIテスト', () => {
  test('PostgreSQL接続テストAPIが応答を返す', async ({ request }) => {
    const response = await request.post('/health/postgres')

    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data).toHaveProperty('success')
    expect(data).toHaveProperty('message')
  })
})
