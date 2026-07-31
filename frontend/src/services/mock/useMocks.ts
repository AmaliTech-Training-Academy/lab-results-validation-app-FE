// Split out from fixtures.ts so checking the flag doesn't force the whole
// mock dataset (and standupEngine) into every bundle that references it —
// callers dynamically import('./fixtures') inside their USE_MOCKS branch.
const env = import.meta.env as unknown as Record<string, string | undefined>
export const USE_MOCKS = (env.VITE_USE_MOCKS ?? 'true') !== 'false'
