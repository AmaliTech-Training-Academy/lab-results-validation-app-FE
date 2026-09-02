export interface PageItem {
  kind: 'page'
  page: number
}
export interface EllipsisItem {
  kind: 'ellipsis'
  key: string
}
export type PagerItem = PageItem | EllipsisItem

/**
 * Bounded pagination item list with ellipsis. Given a 1-based `page` among
 * `totalPages`, keeps the first/last pages plus a window around the current
 * one; large gaps collapse into "…" markers.
 */
export function pagerItems(page: number, totalPages: number): PagerItem[] {
  const total = Math.max(totalPages, 1)
  const current = Math.min(Math.max(page, 1), total)

  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => ({ kind: 'page', page: i + 1 }))
  }

  const items: PagerItem[] = [{ kind: 'page', page: 1 }]
  const windowStart = Math.max(2, current - 1)
  const windowEnd = Math.min(total - 1, current + 1)

  if (windowStart > 2) items.push({ kind: 'ellipsis', key: 'ell-l' })
  for (let p = windowStart; p <= windowEnd; p++) items.push({ kind: 'page', page: p })
  if (windowEnd < total - 1) items.push({ kind: 'ellipsis', key: 'ell-r' })

  items.push({ kind: 'page', page: total })
  return items
}

/**
 * Standard per-page options across all tables. Views were split between
 * [10,15,…40] and [10,25,50]; this is the single list.
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50]
