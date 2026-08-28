/**
 * Tiny localStorage-backed persistence for user UI preferences (currently:
 * visible table columns and rows-per-page). Failure-safe — private mode or
 * quota errors degrade silently to defaults.
 */

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* non-fatal by design */
  }
}

/**
 * Restores persisted visibility flags over `defaults`, dropping keys that no
 * longer exist in the schema (so renamed/removed columns never resurrect).
 */
export function loadColumns<K extends string>(key: string, defaults: Record<K, boolean>): Record<K, boolean> {
  const saved = read<Partial<Record<K, boolean>> | null>(key, null)
  if (!saved || typeof saved !== 'object') return { ...defaults }
  const merged = { ...defaults }
  for (const k of Object.keys(defaults) as K[]) {
    if (typeof saved[k] === 'boolean') merged[k] = saved[k] as boolean
  }
  return merged
}

export function saveColumns<K extends string>(key: string, cols: Record<K, boolean>): void {
  write(key, cols)
}

export function loadPageSize(key: string, fallback: number, allowed: number[]): number {
  const saved = read<number | null>(key, null)
  return typeof saved === 'number' && allowed.includes(saved) ? saved : fallback
}

export function savePageSize(key: string, size: number): void {
  write(key, size)
}
