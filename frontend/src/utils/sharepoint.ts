// Display helpers for SharePoint's opaque per-file identifiers (cTag/hash) — see
// FileIngestionSummary / IngestionRunAuditResponse.

/**
 * `revision` is the numeric version the backend parsed out of the raw cTag (e.g. "v89" for
 * "c:{6B0CF5FB-13F3-4368-AF03-84091F227C3E},89") — shows that when available, since the raw cTag
 * is GUID soup no one reads at a glance. Falls back to the raw cTag (still true, just unreadable)
 * rather than hiding data when the backend couldn't parse a revision out of it, and to an em dash
 * when there's nothing at all.
 */
export function formatFileVersion(revision: number | null | undefined, rawCTag: string | null | undefined): string {
  if (revision != null) return `v${revision}`
  return rawCTag ?? '—'
}
