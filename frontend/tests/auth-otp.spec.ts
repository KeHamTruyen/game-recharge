import { test, expect } from '@playwright/test'

for (const mode of ['register', 'reset'] as const) {
  test(`shows ${mode} OTP errors and clears them on a successful retry`, async ({ page }) => {
    let attempts = 0
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      let data: unknown = {}
      let status = 200
      if (path.endsWith('/auth/session')) status = 401
      else if (path.endsWith('/auth/register')) { status = 202; data = { requiresVerification: true } }
      else if (path.endsWith('/auth/register/verify') || path.endsWith('/auth/reset-password')) {
        if (++attempts === 1) {
          await route.fulfill({ status: 400, json: { success: false, error: 'Incorrect verification code' } })
          return
        }
        data = { user: { id: 'test', email: 'test@example.invalid', name: 'Test', role: 'CUSTOMER' } }
      }
      else if (/\/(services|topup-templates|product-statuses|tags)$/.test(path)) data = []
      else if (path.endsWith('/orders/mine')) data = { items: [], hasNext: false }
      else if (path.endsWith('/wiki')) data = { entries: [], next: null }
      await route.fulfill({ status, json: { success: status < 400, data } })
    })
    await page.goto('/nap-game')
    await page.locator('.login-button').click()
    if (mode === 'register') {
      await page.locator('.auth-tabs button').nth(1).click()
      const fields = page.locator('.login-modal form input')
      await fields.nth(0).fill('Test User')
      await fields.nth(1).fill('test@example.invalid')
      await fields.nth(2).fill('TestPassword123!')
      await fields.nth(3).fill('TestPassword123!')
    } else {
      await page.locator('.password-label button').click()
      await page.locator('.login-modal input[type=email]').fill('test@example.invalid')
    }
    await page.locator('.login-modal button[type=submit]').click()
    await page.locator('.reset-success input').first().fill('000000')
    if (mode === 'reset') await page.locator('.reset-success input[type=password]').fill('NewPassword123!')
    await page.locator('.reset-success button').click()
    await expect(page.getByRole('alert')).toHaveText('Incorrect verification code')
    await page.locator('.reset-success input').first().fill('123456')
    await page.locator('.reset-success button').click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    if (mode === 'register') await expect(page.locator('.login-modal')).toHaveCount(0)
    else await expect(page.locator('.login-modal form')).toBeVisible()
  })
}
