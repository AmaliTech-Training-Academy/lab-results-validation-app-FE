import { watch, type Ref } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'

/**
 * Two-way sync between refs and URL query params so table state (search,
 * filters, sort, page) survives reloads and is shareable via the address bar.
 *
 * - Refs initialise from the current query; `parse` defaults/validates values.
 * - Changes flow back with `router.replace` (no history spam) and are dropped
 *   when they equal their empty/default representation, keeping URLs clean.
 */
export function useQueryParam<T>(opts: {
  key: string
  target: Ref<T>
  parse?: (raw: string | undefined) => T
  encode?: (value: T) => string | null // null → remove param
}): void {
  const route = useRoute()
  const router = useRouter()
  let applying = false

  if (route.query[opts.key] !== undefined && opts.parse) {
    opts.target.value = opts.parse(paramValue(route.query[opts.key]))
  }

  watch(
    () => route.query[opts.key],
    (raw) => {
      applying = true
      try {
        if (!opts.parse) return
        opts.target.value = opts.parse(raw === undefined ? undefined : paramValue(raw))
      } finally {
        applying = false
      }
    },
  )

  watch(opts.target, (value) => {
    if (applying || !opts.encode) return
    const next: LocationQuery = { ...route.query }
    const enc = opts.encode(value)
    if (enc === null || enc === '') delete next[opts.key]
    else next[opts.key] = enc
    router.replace({ query: next }).catch(() => {})
  })
}

function paramValue(raw: unknown): string | undefined {
  return Array.isArray(raw) ? String(raw[0]) : raw == null ? undefined : String(raw)
}
