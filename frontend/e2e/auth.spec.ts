import { expect, test } from '@playwright/test'
import { seedAdmin } from './seed'

/**
 * Journeys 1 and 2 — signing in, and the password change the app can force on you.
 *
 * <p>The forced-change guard is the reason this file exists. It lives in the router
 * (`navigationGuard`), so no backend test can reach it: the rule is "until you have changed your
 * password, every route sends you back to /set-password", and only a browser can prove that.
 */

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
}

test('E1 — a seeded admin signs in and lands on the dashboard', async ({ page }) => {
  const admin = seedAdmin()

  await signIn(page, admin.email, admin.password)

  await expect(page).toHaveURL(/\/admin\/dashboard/)
})

test('E1 — a wrong password is refused with a message a person can read', async ({ page }) => {
  const admin = seedAdmin()

  await signIn(page, admin.email, 'Definitely!NotIt9')

  // Still on the sign-in page, and told why — not a blank screen or a raw status code.
  await expect(page).toHaveURL(/\/login/)
  const message = page.locator('.form-error, [role="alert"]').first()
  await expect(message).toBeVisible()
  await expect(message).not.toHaveText(/^\s*$/)
  await expect(message).not.toHaveText(/\b(500|undefined|null|Error:)\b/)
})

test('E1 — an unknown account is refused the same way, revealing nothing', async ({ page }) => {
  const admin = seedAdmin()
  await signIn(page, admin.email, 'Definitely!NotIt9')
  const wrongPasswordMessage = await page.locator('.form-error, [role="alert"]').first().textContent()

  await signIn(page, 'e2e.nobody.here@amalitechtraining.org', 'Definitely!NotIt9')
  const unknownAccountMessage = await page.locator('.form-error, [role="alert"]').first().textContent()

  // If these differed, the sign-in page would tell an attacker which addresses are real accounts.
  expect(unknownAccountMessage?.trim()).toBe(wrongPasswordMessage?.trim())
})

test('E2 AC1 — a first-time admin is held on set-password and cannot go anywhere else', async ({ page }) => {
  const admin = seedAdmin(true)

  await signIn(page, admin.email, admin.password)
  await expect(page).toHaveURL(/\/set-password/)

  // The part no backend test can reach: the guard lives in the router, so it only exists in a
  // browser. What matters is the outcome — no admin screen is reachable — not which redirect
  // delivers it. Two different mechanisms combine, and it is worth knowing which is which:
  //
  //   - typing an admin URL after a full reload lands on /login, because the first-time session is
  //     held in memory and a reload drops it;
  //   - signing in again lands on /set-password, because the guard sends them there.
  //
  // Either way the admin screens stay out of reach, which is what E2 AC1 asks for.
  for (const route of ['/admin/dashboard', '/admin/cohorts', '/admin/runs', '/admin/audit']) {
    await page.goto(route)
    await expect(page, `${route} must not be reachable before the password is changed`)
      .toHaveURL(/\/(login|set-password)/)
    await expect(page.locator('body')).not.toContainText(/Dashboard|Cohorts|Audit log/i)
  }

  // And signing in again does not let them slip past — it puts them straight back.
  await signIn(page, admin.email, admin.password)
  await expect(page).toHaveURL(/\/set-password/)
})

test('E2 AC2 — changing the password releases the hold and the new one works', async ({ page }) => {
  const admin = seedAdmin(true)
  const newPassword = `E2e!changed${Date.now().toString(36)}Aa1`

  await signIn(page, admin.email, admin.password)
  await expect(page).toHaveURL(/\/set-password/)

  await page.locator('#setpw-new').fill(newPassword)
  await page.locator('#setpw-confirm').fill(newPassword)
  await page.getByRole('button', { name: /set password|reset password/i }).click()

  await expect(page).toHaveURL(/\/admin\/dashboard/)

  // And it is really changed, not just waved through for this session.
  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await signIn(page, admin.email, newPassword)
  await expect(page).toHaveURL(/\/admin\/dashboard/)
})
