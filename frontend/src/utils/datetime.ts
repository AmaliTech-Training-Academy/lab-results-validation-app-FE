/**
 * Human-friendly, locale-aware date/time formatting for display.
 *
 * Backend timestamps are ISO strings in UTC; `slice()`-based formatting shown
 * them verbatim (raw UTC) which read wrong for anyone outside UTC. These
 * helpers convert to the viewer's local time and format via Intl.
 */

/** Fallback when a value is missing or unparseable. */
const DASH = '—'

export function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** e.g. "2 Mar 2026" */
export function fmtDate(iso: string | null | undefined): string {
  const d = parseIso(iso)
  if (!d) return DASH
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

/** e.g. "14:32" */
export function fmtTime(iso: string | null | undefined): string {
  const d = parseIso(iso)
  if (!d) return ''
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

/** The later of runAt / completedAt / startedAt, whichever exists. */
export function whenOf(...candidates: Array<string | null | undefined>): string | undefined {
  return candidates.find((c): c is string => !!c)
}
