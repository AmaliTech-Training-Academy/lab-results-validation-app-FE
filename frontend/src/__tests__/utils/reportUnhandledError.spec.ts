import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { reportUnhandledError } from '@/utils/reportUnhandledError'
import { useToastStore } from '@/stores/toast'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('reportUnhandledError', () => {
  it('shows the real backend message when the error carries one, instead of a generic line', () => {
    reportUnhandledError(new Error('Reference bundle failed integrity check: 3 labs missing a module link'), 'test')

    const toast = useToastStore()
    const last = toast.toasts[toast.toasts.length - 1]
    expect(last?.title).toBe('Something went wrong')
    expect(last?.body).toBe('Reference bundle failed integrity check: 3 labs missing a module link')
  })

  it('falls back to a generic message only when the thrown value has nothing useful to show', () => {
    reportUnhandledError('a bare string, not an Error', 'test')

    const toast = useToastStore()
    const last = toast.toasts[toast.toasts.length - 1]
    expect(last?.body).toBe('An unexpected error occurred. Please try again, and contact support if it keeps happening.')
  })

  it('falls back to a generic message for an Error with a blank message', () => {
    reportUnhandledError(new Error(''), 'test')

    const toast = useToastStore()
    const last = toast.toasts[toast.toasts.length - 1]
    expect(last?.body).toBe('An unexpected error occurred. Please try again, and contact support if it keeps happening.')
  })

  it('still special-cases a stale-deploy chunk-load failure instead of showing its raw message', () => {
    reportUnhandledError(new Error('Failed to fetch dynamically imported module: /assets/foo.js'), 'test')

    const toast = useToastStore()
    const last = toast.toasts[toast.toasts.length - 1]
    expect(last?.title).toBe('App update available')
  })
})
