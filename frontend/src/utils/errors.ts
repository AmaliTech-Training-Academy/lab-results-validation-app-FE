import type { LocatedError } from '@/types/common.types'

/** Extracts a human-readable message from a caught value, falling back when it isn't an Error. */
export function toErrorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

/**
 * Some gate/file failure streams send plain strings, others already send
 * structured `LocatedError` objects (file/sheet/row/rule/message) — normalize
 * either shape to `LocatedError[]` so the UI can render whatever detail is
 * actually available instead of collapsing everything to a bare message.
 */
export function toLocatedErrors(raw: Array<string | LocatedError>): LocatedError[] {
  return raw.map((item) => (typeof item === 'string' ? { message: item } : item))
}

/** Renders a `LocatedError` as one scannable line: "sheet · row 5 · RULE — message". Omits `file` — callers that group errors by file already show it as a section header. */
export function formatLocatedError(e: LocatedError): string {
  const loc = [e.location ?? [e.sheet, e.row != null ? `row ${e.row}` : ''].filter(Boolean).join(' '), e.rule]
    .filter(Boolean)
    .join(' · ')
  return loc ? `${loc} — ${e.message}` : e.message
}
