import { onMounted } from 'vue'

const DEFAULT_SUFFIX = ' · Validata'

/**
 * Sets a per-view document title once mounted. Browser tabs/history all read
 * "Validata" otherwise, which makes navigating between views unreviewable.
 */
export function usePageTitle(title: string): void {
  onMounted(() => {
    document.title = `${title}${DEFAULT_SUFFIX}`
  })
}
