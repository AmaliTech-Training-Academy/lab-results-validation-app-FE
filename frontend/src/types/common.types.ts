// Shared shapes used across the v2 domain types.

/** Spring-style paged response envelope (field names confirmed live against GET /cohorts). */
export interface Paged<T> {
  content: T[]
  number: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

/**
 * A located validation/ingestion error. Flexible enough to carry a link-level
 * message, a missing-folder/file name, or a per-file + sheet + row + rule
 * failure (PRD §3.3 Gate errors, §4.4 ingestion rules).
 */
export interface LocatedError {
  file?: string
  sheet?: string
  row?: number
  /** Pre-formatted alternative to sheet/row, e.g. "sheet Module-1 row 5" (some endpoints report this instead of the split fields). */
  location?: string
  /** Rule id, e.g. "S2", "R1", "F2" (PRD §4.4) or a stand-up gate rule. */
  rule?: string
  message: string
}
