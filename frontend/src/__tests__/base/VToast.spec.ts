import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import VToast from '@/components/base/VToast.vue'
import { useToastStore } from '@/stores/toast'

function mountToast() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(VToast, { global: { plugins: [pinia] } })
  const store = useToastStore()
  return { wrapper, store }
}

describe('VToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  // ── UI-05: appears on success/error actions and auto-dismisses ────────────

  describe('visibility', () => {
    it('does not render when there is no toast', () => {
      const { wrapper } = mountToast()
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    })

    it('renders when the store has an active toast', async () => {
      const { store } = mountToast()
      store.show({ tone: 'success', title: 'Upload complete' })
      await nextTick()
      expect(document.body.querySelector('[role="alert"]')).not.toBeNull()
    })
  })

  describe('content', () => {
    it.each([
      ['success', 'toast-success'],
      ['warning', 'toast-warning'],
      ['danger',  'toast-danger'],
      ['info',    'toast-info'],
    ] as const)('applies toast-%s class for tone="%s"', async (tone, cls) => {
      const { store } = mountToast()
      store.show({ tone, title: 'msg' })
      await nextTick()
      expect(document.body.querySelector(`.${cls}`)).not.toBeNull()
    })

    it('renders the toast title', async () => {
      const { store } = mountToast()
      store.show({ tone: 'success', title: 'File uploaded' })
      await nextTick()
      expect(document.body.querySelector('.toast-title')?.textContent).toBe('File uploaded')
    })

    it('renders the toast body when provided', async () => {
      const { store } = mountToast()
      store.show({ tone: 'info', title: 'Note', body: 'Some detail here.' })
      await nextTick()
      expect(document.body.querySelector('.toast-body')?.textContent).toBe('Some detail here.')
    })

    it('does not render .toast-body when body is not provided', async () => {
      const { store } = mountToast()
      store.show({ tone: 'success', title: 'OK' })
      await nextTick()
      expect(document.body.querySelector('.toast-body')).toBeNull()
    })

    it('renders a dismiss button with accessible label', async () => {
      const { store } = mountToast()
      store.show({ tone: 'success', title: 'Done' })
      await nextTick()
      const btn = document.body.querySelector('.toast-x')
      expect(btn).not.toBeNull()
      expect(btn?.getAttribute('aria-label')).toBe('Dismiss notification')
    })
  })

  describe('dismiss behaviour', () => {
    it('disappears after the default timeout (5 s)', async () => {
      const { wrapper, store } = mountToast()
      store.show({ tone: 'success', title: 'Auto-dismiss' })
      await nextTick()
      expect(document.body.querySelector('[role="alert"]')).not.toBeNull()

      vi.advanceTimersByTime(5000)
      await wrapper.vm.$nextTick()
      expect(document.body.querySelector('[role="alert"]')).toBeNull()
    })

    it('disappears after a custom duration', async () => {
      const { wrapper, store } = mountToast()
      store.show({ tone: 'info', title: 'Quick' }, 2000)
      await nextTick()

      vi.advanceTimersByTime(1999)
      await wrapper.vm.$nextTick()
      expect(document.body.querySelector('[role="alert"]')).not.toBeNull()

      vi.advanceTimersByTime(1)
      await wrapper.vm.$nextTick()
      expect(document.body.querySelector('[role="alert"]')).toBeNull()
    })

    it('dismisses immediately when the dismiss button is clicked', async () => {
      const { wrapper, store } = mountToast()
      store.show({ tone: 'danger', title: 'Error occurred' })
      await nextTick()

      const xBtn = document.body.querySelector('.toast-x') as HTMLElement
      xBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await wrapper.vm.$nextTick()
      expect(document.body.querySelector('[role="alert"]')).toBeNull()
    })

    it('resets the timer when a new toast arrives while one is visible', async () => {
      const { wrapper, store } = mountToast()
      store.show({ tone: 'success', title: 'First' }, 5000)
      await nextTick()

      vi.advanceTimersByTime(3000)
      store.show({ tone: 'warning', title: 'Second' }, 5000)
      await nextTick()

      // 3 s into the second toast's window — should still be visible
      vi.advanceTimersByTime(3000)
      await wrapper.vm.$nextTick()
      expect(document.body.querySelector('[role="alert"]')).not.toBeNull()

      // Advance to complete the 5 s window of the second toast
      vi.advanceTimersByTime(2000)
      await wrapper.vm.$nextTick()
      expect(document.body.querySelector('[role="alert"]')).toBeNull()
    })
  })

  describe('accessibility', () => {
    it('toast container has role="alert"', async () => {
      const { store } = mountToast()
      store.show({ tone: 'success', title: 'Done' })
      await nextTick()
      expect(document.body.querySelector('[role="alert"]')).not.toBeNull()
    })

    it('toast has aria-live="assertive"', async () => {
      const { store } = mountToast()
      store.show({ tone: 'danger', title: 'Error' })
      await nextTick()
      expect(document.body.querySelector('[aria-live="assertive"]')).not.toBeNull()
    })
  })
})
