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

    it('stacks a new toast alongside one already visible, each on its own timer', async () => {
      const { wrapper, store } = mountToast()
      store.show({ tone: 'success', title: 'First' }, 5000)
      await nextTick()

      vi.advanceTimersByTime(3000)
      store.show({ tone: 'warning', title: 'Second' }, 5000)
      await nextTick()
      expect(document.body.querySelectorAll('[role="alert"]')).toHaveLength(2)

      // First's 5 s window elapses (3 s already spent + 2 more) — Second still has 3 s left of its own window
      vi.advanceTimersByTime(2000)
      await wrapper.vm.$nextTick()
      const remaining = document.body.querySelectorAll('[role="alert"]')
      expect(remaining).toHaveLength(1)
      expect(remaining[0]?.querySelector('.toast-title')?.textContent).toBe('Second')

      // Second's window completes 3 s later
      vi.advanceTimersByTime(3000)
      await wrapper.vm.$nextTick()
      expect(document.body.querySelector('[role="alert"]')).toBeNull()
    })

    it('drops the oldest toast once more than the visible cap are queued', async () => {
      const { wrapper, store } = mountToast()
      store.show({ tone: 'info', title: 'One' }, 0)
      store.show({ tone: 'info', title: 'Two' }, 0)
      store.show({ tone: 'info', title: 'Three' }, 0)
      await nextTick()
      expect(document.body.querySelectorAll('[role="alert"]')).toHaveLength(3)

      store.show({ tone: 'info', title: 'Four' }, 0)
      await wrapper.vm.$nextTick()

      const titles = [...document.body.querySelectorAll('.toast-title')].map((el) => el.textContent)
      expect(titles).toEqual(['Two', 'Three', 'Four'])
    })

    it('dismissing one toast leaves the others untouched', async () => {
      const { wrapper, store } = mountToast()
      store.show({ tone: 'success', title: 'Keep me' }, 0)
      const secondId = store.show({ tone: 'danger', title: 'Dismiss me' }, 0)
      await nextTick()

      store.dismiss(secondId)
      await wrapper.vm.$nextTick()

      const titles = [...document.body.querySelectorAll('.toast-title')].map((el) => el.textContent)
      expect(titles).toEqual(['Keep me'])
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
