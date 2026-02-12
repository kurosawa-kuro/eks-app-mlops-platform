import { test, expect } from '@playwright/test'

/**
 * Purchase Flow E2E Test
 *
 * Tests the complete purchase flow:
 * Login → Product List → Add to Cart → Checkout → Order Confirmation
 *
 * This test verifies the integration between:
 * - Frontend (Next.js)
 * - Backend API (Hono)
 * - Database (PostgreSQL via Prisma)
 * - Authentication (Cookie-based JWT)
 */
test.describe.serial('購入フロー E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login via UI (not JWT injection)
    await page.goto('/login')

    await page.fill('input[type="email"]', 'user1@example.com')
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'CHANGE_ME')

    await page.getByRole('button', { name: 'Login' }).click()

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
  })

  test('商品一覧 → カート追加 → チェックアウト → 注文確認', async ({ page }) => {
    // 1. Navigate to products page
    await page.goto('/shop/products')
    await expect(page.locator('h1')).toContainText('Products')

    // 2. Verify seed data is displayed (商品A, 商品B, 商品C)
    await expect(page.getByText('商品A')).toBeVisible()

    // 3. Add first product to cart
    await page.getByRole('button', { name: 'Add to Cart' }).first().click()
    await expect(page.getByText('Added to cart!')).toBeVisible()

    // 4. Navigate to cart page (click header cart link, not product cards)
    await page.getByRole('link', { name: /^Cart/ }).first().click()
    await expect(page).toHaveURL('/shop/cart')

    // 5. Verify cart contains the product
    await expect(page.getByText('商品A')).toBeVisible()
    await expect(page.getByText('￥1,200', { exact: false })).toBeVisible()

    // 6. Checkout
    await page.getByRole('button', { name: 'Checkout' }).click()

    // 7. Verify order completion
    await expect(page).toHaveURL(/\/shop\/orders\?new=/)
    await expect(page.getByText('Order placed successfully!')).toBeVisible()
  })
})

test.describe('認証・アクセス制御', () => {
  test('未認証ユーザーはログインページにリダイレクトされる', async ({ page }) => {
    // Try to access protected page without login
    await page.goto('/shop/products')

    // Should redirect to login
    await expect(page).toHaveURL('/login')
  })

  test('ログイン画面が正しく表示される', async ({ page }) => {
    await page.goto('/login')

    await expect(page.locator('h1')).toContainText('Login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()
  })
})
