import type { Page } from '@playwright/test'
import { seedAdmin } from './seed'

/** Signs in a freshly seeded admin and waits for the dashboard. */
export async function signInAsAdmin(page: Page): Promise<void> {
  const admin = seedAdmin()
  await page.goto('/login')
  await page.locator('#login-email').fill(admin.email)
  await page.locator('#login-password').fill(admin.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 20_000 })
}

/** A folder name unique to one journey, so cohorts and drive folders never collide. */
export function uniqueFolder(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}
