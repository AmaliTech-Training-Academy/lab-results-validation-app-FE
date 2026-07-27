import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VDrawer from '@/components/base/VDrawer.vue'

// Mount with open:false then transition to open:true so the watcher fires and
// registers the keydown / focus listeners (watch has no immediate:true).
async function openDrawer(extraProps: Record<string, unknown> = {}) {
  const wrapper = mount(VDrawer, {
    props: { open: false, title: 'Test drawer', ...extraProps },
  })
  await wrapper.setProps({ open: true })
  await nextTick()
  return wrapper
}

function mountOpen(extraProps: Record<string, unknown> = {}) {
  return mount(VDrawer, {
    props: { open: true, title: 'Test drawer', ...extraProps },
  })
}

describe('VDrawer', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  // ── UI-04: opens and closes cleanly ──────────────────────────────────────

  describe('visibility', () => {
    it('does not render when open is false', () => {
      mount(VDrawer, { props: { open: false, title: 'Hidden' } })
      expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    })

    it('renders the drawer when open is true', () => {
      mountOpen()
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    })
  })

  describe('content', () => {
    it('renders the title', () => {
      mountOpen({ title: 'Edit learner' })
      expect(document.body.querySelector('.drawer-title')?.textContent).toBe('Edit learner')
    })

    it('does not render subtitle element when not provided', () => {
      mountOpen()
      expect(document.body.querySelector('.drawer-sub')).toBeNull()
    })

    it('renders subtitle when provided', () => {
      mountOpen({ subtitle: 'All fields are required.' })
      expect(document.body.querySelector('.drawer-sub')?.textContent).toBe('All fields are required.')
    })

    it('renders a close (×) button with accessible label', () => {
      mountOpen()
      const xBtn = document.body.querySelector('.drawer-x')
      expect(xBtn).not.toBeNull()
      expect(xBtn?.getAttribute('aria-label')).toBe('Close')
    })

    it('renders default slot content in drawer body', () => {
      mount(VDrawer, {
        props: { open: true, title: 'T' },
        slots: { default: '<p class="body-content">drawer body</p>' },
      })
      expect(document.body.querySelector('.body-content')?.textContent).toBe('drawer body')
    })

    it('renders footer slot when provided', () => {
      mount(VDrawer, {
        props: { open: true, title: 'T' },
        slots: { footer: '<button class="footer-btn">Save</button>' },
      })
      expect(document.body.querySelector('.drawer-foot')).not.toBeNull()
      expect(document.body.querySelector('.footer-btn')).not.toBeNull()
    })

    it('does not render drawer-foot when footer slot is not used', () => {
      mountOpen()
      expect(document.body.querySelector('.drawer-foot')).toBeNull()
    })
  })

  describe('close behaviour', () => {
    it('emits close when the scrim (backdrop) is clicked', async () => {
      const wrapper = await openDrawer()
      const scrim = document.body.querySelector('.drawer-scrim') as HTMLElement
      scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('does not emit close when the drawer panel itself is clicked', async () => {
      const wrapper = await openDrawer()
      const panel = document.body.querySelector('.drawer') as HTMLElement
      panel.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
      expect(wrapper.emitted('close')).toBeUndefined()
    })

    it('emits close when the × close button is clicked', async () => {
      const wrapper = await openDrawer()
      const xBtn = document.body.querySelector('.drawer-x') as HTMLElement
      xBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('emits close when Escape key is pressed', async () => {
      const wrapper = await openDrawer()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await nextTick()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('does not emit close for non-Escape keys', async () => {
      const wrapper = await openDrawer()
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
      mountOpen({ title: 'Labelled drawer' })
      const dialog = document.body.querySelector('[role="dialog"]')!
      const labelId = dialog.getAttribute('aria-labelledby')!
      expect(document.getElementById(labelId)?.textContent).toBe('Labelled drawer')
    })
  })
})
