import { expect, test } from '@playwright/test'
import { seedAdmin } from './seed'

test('the app loads and a seeded admin can sign in', async ({ page }) => {
  const admin = seedAdmin()

  await page.goto('/login')
  await page.locator('#login-email').fill(admin.email)
  await page.locator('#login-password').fill(admin.password)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()

  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 20_000 })
})
