import { test, expect } from '@playwright/test'
import { loginAsUser, loginAsAdmin, logout } from './helpers/auth.js'

/**
 * EC Shop E2E Tests
 *
 * Note: These tests run against an in-memory store that persists across tests.
 * Tests are designed to be run in serial mode and build upon each other's state.
 *
 * Authentication:
 * - /shop/products: Guest accessible (no auth required)
 * - /shop/cart, /shop/orders, /shop/checkout: Requires user login
 * - /shop/audit: Requires admin login
 */
test.describe.serial('EC Shop E2E', () => {
  test.beforeEach(async ({ context }) => {
    // Login as regular user for most tests
    await loginAsUser(context)
  })

  test('購入フロー一周', async ({ page }) => {
    // 1. 商品一覧を開く
    await page.goto('/shop/products')
    await expect(page.locator('h1')).toContainText('商品一覧')

    // 商品が3つ表示されていることを確認
    await expect(page.locator('[data-product-id]')).toHaveCount(3)

    // 2. 商品Aをカートに追加
    await page.locator('[data-product-id="p1"] button').click()

    // 3. カートページで商品Aが存在することを確認
    await expect(page).toHaveURL('/shop/cart')
    await expect(page.locator('[data-product-id="p1"]')).toBeVisible()

    // カートの小計が正しいことを確認
    await expect(page.locator('.cart-subtotal')).toContainText('1,200')

    // 4. 注文確定（削除ボタンではなくチェックアウトボタンを選択）
    await page.getByRole('button', { name: '注文を確定する' }).click()

    // 5. 注文詳細に遷移し、注文が表示される
    await expect(page).toHaveURL(/\/shop\/orders\//)
    await expect(page.locator('.order-total')).toContainText('1,200')

    // 6. 注文一覧ページへ
    await page.goto('/shop/orders')
    await expect(page.locator('.order-item')).toHaveCount(1)
  })

  test('監査ログを確認 (admin)', async ({ page, context }) => {
    // Switch to admin user for audit log access
    await logout(context)
    await loginAsAdmin(context)

    await page.goto('/shop/audit')
    await expect(page.locator('text=cart:add:p1')).toBeVisible()
    await expect(page.locator('text=order:checkout')).toBeVisible()
  })

  test('カートへの追加・削除', async ({ page }) => {
    // 商品一覧から商品Cを追加（前のテストでp1は購入済み）
    await page.goto('/shop/products')
    await page.locator('[data-product-id="p3"] button').click()

    // カートに商品Cがあることを確認
    await expect(page).toHaveURL('/shop/cart')
    await expect(page.locator('[data-product-id="p3"]')).toBeVisible()

    // 商品Cを削除（削除ボタンを使用）
    await page.locator('[data-product-id="p3"] button.secondary').click()

    // カートが空になったことを確認
    await expect(page.locator('text=カートは空です')).toBeVisible()
  })

  test('空のカートでチェックアウトできない', async ({ page }) => {
    // 空のカートページへ（前のテストでカートは空）
    await page.goto('/shop/cart')
    await expect(page.locator('text=カートは空です')).toBeVisible()

    // チェックアウトボタンがないことを確認
    await expect(page.getByRole('button', { name: '注文を確定する' })).toHaveCount(0)
  })

  test('複数商品の購入', async ({ page }) => {
    // 商品A, B, Cを追加
    await page.goto('/shop/products')
    await page.locator('[data-product-id="p1"] button').click()
    await page.goto('/shop/products')
    await page.locator('[data-product-id="p2"] button').click()
    await page.goto('/shop/products')
    await page.locator('[data-product-id="p3"] button').click()

    // カートに3商品
    await expect(page).toHaveURL('/shop/cart')
    await expect(page.locator('tbody tr')).toHaveCount(3)

    // 合計: 1200 + 2300 + 500 = 4000
    await expect(page.locator('.cart-subtotal')).toContainText('4,000')

    // チェックアウト
    await page.getByRole('button', { name: '注文を確定する' }).click()
    await expect(page).toHaveURL(/\/shop\/orders\//)
    await expect(page.locator('.order-total')).toContainText('4,000')

    // 注文一覧に2件あることを確認（最初のテストの注文と合わせて）
    await page.goto('/shop/orders')
    await expect(page.locator('.order-item')).toHaveCount(2)
  })
})

test.describe('EC Shop ページ表示', () => {
  test('商品一覧ページが正しく表示される (ゲストアクセス可)', async ({ page }) => {
    // No authentication required for products page
    await page.goto('/shop/products')

    await expect(page).toHaveTitle('商品一覧 - EC Shop')
    await expect(page.locator('h1')).toHaveText('商品一覧')

    // ナビゲーションが表示されている
    await expect(page.locator('nav')).toBeVisible()
    await expect(page.locator('a[href="/shop/cart"]')).toBeVisible()
  })

  test('カートページが正しく表示される (要ログイン)', async ({ page, context }) => {
    await loginAsUser(context)
    await page.goto('/shop/cart')

    await expect(page).toHaveTitle('カート - EC Shop')
    await expect(page.locator('h1')).toHaveText('カート')
  })

  test('注文履歴ページが正しく表示される (要ログイン)', async ({ page, context }) => {
    await loginAsUser(context)
    await page.goto('/shop/orders')

    await expect(page).toHaveTitle('注文履歴 - EC Shop')
    await expect(page.locator('h1')).toHaveText('注文履歴')
  })

  test('監査ログページが正しく表示される (要Admin)', async ({ page, context }) => {
    await loginAsAdmin(context)
    await page.goto('/shop/audit')

    await expect(page).toHaveTitle('監査ログ - EC Shop')
    await expect(page.locator('h1')).toHaveText('監査ログ')
  })

  test('未認証ユーザーはカートページにアクセスできない', async ({ page }) => {
    // No login - should redirect to products
    await page.goto('/shop/cart')
    await expect(page).toHaveURL('/shop/products')
  })

  test('一般ユーザーは監査ログにアクセスできない', async ({ page, context }) => {
    // Login as regular user (not admin)
    await loginAsUser(context, { role: 'user' })

    // Navigate and capture response
    const response = await page.goto('/shop/audit')

    // Should receive 403 Forbidden (roleRequired throws HTTPException)
    expect(response?.status()).toBe(403)
  })
})

test.describe('EC Shop ナビゲーション', () => {
  test('ナビゲーションリンクが正しく動作する (認証済み)', async ({ page, context }) => {
    await loginAsAdmin(context) // Admin can access all pages
    await page.goto('/shop/products')

    // カートへ
    await page.locator('a[href="/shop/cart"]').click()
    await expect(page).toHaveURL('/shop/cart')

    // 注文履歴へ
    await page.locator('a[href="/shop/orders"]').click()
    await expect(page).toHaveURL('/shop/orders')

    // 監査ログへ (admin only)
    await page.locator('a[href="/shop/audit"]').click()
    await expect(page).toHaveURL('/shop/audit')

    // 商品一覧へ戻る
    await page.locator('a[href="/shop/products"]').click()
    await expect(page).toHaveURL('/shop/products')
  })
})
