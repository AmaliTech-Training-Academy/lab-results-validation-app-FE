import { resetDriveRoot, sql } from './seed'

/**
 * Runs once before the suite.
 *
 * <p>Checks the backend is actually there before any journey runs — a suite that fails eight times
 * with "element not found" when the real problem is a stopped backend wastes a lot of somebody's
 * afternoon. Then clears the fixture drive so a previous run's folders cannot influence this one.
 */
export default async function globalSetup(): Promise<void> {
  const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:8081'

  let reachable = false
  try {
    const response = await fetch(`${apiTarget}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'probe@example.test', password: 'not-a-real-one' }),
    })
    // Any HTTP answer means the backend is up; 401 is the expected one for bad credentials.
    reachable = response.status > 0
  } catch {
    reachable = false
  }

  if (!reachable) {
    throw new Error(
      `The backend is not answering on ${apiTarget}.\n` +
        'Start the end-to-end stack first — see e2e/README.md. In short: the two containers, then ' +
        'the backend with SHAREPOINT_SOURCE=fixtures on port 8081.',
    )
  }

  try {
    sql('SELECT 1')
  } catch {
    throw new Error(
      'The end-to-end database container is not reachable (docker exec validata-e2e-db). ' +
        'See e2e/README.md.',
    )
  }

  resetDriveRoot()
}
