// Split out from fixtures.ts so checking the flag doesn't force the whole
// mock dataset (and standupEngine) into every bundle that references it —
// callers dynamically import('./fixtures') inside their USE_MOCKS branch.
//
// Mocks are OFF by default: the app talks to the real backend (in dev, Vite
// proxies /api -> http://localhost:8080). Opt back in with VITE_USE_MOCKS=true
// to run against the in-app mock dataset for an offline demo.
const env = import.meta.env as unknown as Record<string, string | undefined>
export const USE_MOCKS = env.VITE_USE_MOCKS === 'true'
