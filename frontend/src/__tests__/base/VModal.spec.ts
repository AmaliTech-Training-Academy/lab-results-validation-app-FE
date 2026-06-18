import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VModal from '@/components/base/VModal.vue'

// Mount with open:false then transition to open:true so the watcher fires and
// registers the keydown / focus listeners (watch has no immediate:true).
async function openModal(extraProps: Record<string, unknown> = {}) {
  const wrapper = mount(VModal, {
    props: { open: false, title: 'Test modal', ...extraProps },
  })
  await wrapper.setProps({ open: true })
  await nextTick() // flush inner nextTick inside the watcher
  return wrapper
}

// For render-only checks open:true upfront is fine (no listener needed).
function mountOpen(extraProps: Record<string, unknown> = {}) {
  return mount(VModal, {
    props: { open: true, title: 'Test modal', ...extraProps },
  })
}

describe('VModal', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  // ── UI-03: opens and closes cleanly ──────────────────────────────────────

  describe('visibility', () => {
    it('does not render when open is false', () => {
      mount(VModal, { props: { open: false, title: 'Hidden' } })
      expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    })

    it('renders the dialog when open is true', () => {
      mountOpen()
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    })
  })

  describe('content', () => {
    it('renders the title', () => {
      mountOpen({ title: 'Confirm deletion' })
      expect(document.body.querySelector('.modal-title')?.textContent).toBe('Confirm deletion')
    })

    it('does not render subtitle element when subtitle is not provided', () => {
      mountOpen()
      expect(document.body.querySelector('.modal-sub')).toBeNull()
    })

    it('renders subtitle when provided', () => {
      mountOpen({ subtitle: 'This cannot be undone.' })
      expect(document.body.querySelector('.modal-sub')?.textContent).toBe('This cannot be undone.')
    })

    it('renders warning icon when tone is warning', () => {
      mountOpen({ tone: 'warning' })
      expect(document.body.querySelector('.modal-ic')).not.toBeNull()
    })

    it('does not render warning icon when tone is not set', () => {
      mountOpen()
      expect(document.body.querySelector('.modal-ic')).toBeNull()
    })

    it('renders default slot content in modal body', () => {
      mount(VModal, {
        props: { open: true, title: 'T' },
        slots: { default: '<p class="body-content">body text</p>' },
      })
      expect(document.body.querySelector('.body-content')?.textContent).toBe('body text')
    })

    it('renders footer slot when provided', () => {
      mount(VModal, {
        props: { open: true, title: 'T' },
        slots: { footer: '<button class="footer-btn">Confirm</button>' },
      })
      expect(document.body.querySelector('.modal-foot')).not.toBeNull()
      expect(document.body.querySelector('.footer-btn')).not.toBeNull()
    })

    it('does not render modal-foot when footer slot is not used', () => {
      mountOpen()
      expect(document.body.querySelector('.modal-foot')).toBeNull()
    })
  })

  describe('close behaviour', () => {
    it('emits close when the scrim is clicked', async () => {
      const wrapper = await openModal()
      const scrim = document.body.querySelector('.modal-scrim') as HTMLElement
      scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('does not emit close when the dialog panel itself is clicked', async () => {
      const wrapper = await openModal()
      const dialog = document.body.querySelector('.modal') as HTMLElement
      dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
      expect(wrapper.emitted('close')).toBeUndefined()
    })

    it('emits close when Escape key is pressed', async () => {
      const wrapper = await openModal()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await nextTick()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('does not emit close for non-Escape keys', async () => {
      const wrapper = await openModal()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await nextTick()
      expect(wrapper.emitted('close')).toBeUndefined()
    })
  })

  describe('accessibility', () => {
    it('dialog has role="dialog"', () => {
      mountOpen()
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    })

    it('dialog has aria-modal="true"', () => {
      mountOpen()
      expect(document.body.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true')
    })

    it('dialog is labelled by the title element (aria-labelledby)', () => {
      mountOpen({ title: 'Labelled modal' })
      const dialog = document.body.querySelector('[role="dialog"]')!
      const labelId = dialog.getAttribute('aria-labelledby')!
      expect(document.getElementById(labelId)?.textContent).toBe('Labelled modal')
    })
  })
})
