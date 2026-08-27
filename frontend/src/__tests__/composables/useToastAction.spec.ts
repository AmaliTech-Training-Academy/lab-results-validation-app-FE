import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastAction } from '@/composables/useToastAction'
import { useToastStore } from '@/stores/toast'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useToastAction', () => {
  it('shows the success toast when the action resolves', async () => {
    const { run } = useToastAction()
    await run(() => Promise.resolve(), {
      success: { tone: 'success', title: 'Saved' },
      error: { tone: 'warning', title: 'Could not save' },
    })

    const toast = useToastStore()
    expect(toast.toasts[toast.toasts.length - 1]).toMatchObject({ title: 'Saved' })
  })

  it('shows the real caught error message in the toast body, not a silent title-only toast', async () => {
    const { run } = useToastAction()
    await run(() => Promise.reject(new Error("Reviewer 'Eric Munyaneza' does not match any active instructor.")), {
      error: { tone: 'warning', title: 'Could not queue send' },
    })

    const toast = useToastStore()
    const last = toast.toasts[toast.toasts.length - 1]
    expect(last?.title).toBe('Could not queue send')
    expect(last?.body).toBe("Reviewer 'Eric Munyaneza' does not match any active instructor.")
  })

  it('lets a caller-supplied body win over the caught error, for a deliberate specific message', async () => {
    const { run } = useToastAction()
    await run(() => Promise.reject(new Error('raw backend detail')), {
      error: { tone: 'warning', title: 'Could not resolve', body: 'This cohort is locked.' },
    })

    const toast = useToastStore()
    expect(toast.toasts[toast.toasts.length - 1]?.body).toBe('This cohort is locked.')
  })

  it('falls back to a title-only toast when the thrown value has no usable message', async () => {
    const { run } = useToastAction()
    await run(() => Promise.reject('not an Error'), {
      error: { tone: 'warning', title: 'Could not save' },
    })

    const toast = useToastStore()
    const last = toast.toasts[toast.toasts.length - 1]
    expect(last?.title).toBe('Could not save')
    expect(last?.body).toBeUndefined()
  })
})
