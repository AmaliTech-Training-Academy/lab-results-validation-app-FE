import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VCombobox from '@/components/base/VCombobox.vue'

const OPTIONS = [
  { id: 'c1', label: 'Cohort Alpha' },
  { id: 'c2', label: 'Cohort Beta' },
  { id: 'c3', label: 'Cohort Gamma' },
]

function mountCombobox(extraProps: Record<string, unknown> = {}) {
  return mount(VCombobox, {
    props: { modelValue: null, options: OPTIONS, ...extraProps },
    attachTo: document.body,
  })
}

async function open(wrapper: ReturnType<typeof mountCombobox>) {
  await wrapper.find('input').trigger('focus')
  await nextTick()
}

describe('VCombobox', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('display', () => {
    it('shows the selected option label when closed', () => {
      const wrapper = mountCombobox({ modelValue: 'c2' })
      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('Cohort Beta')
    })

    it('shows allLabel when modelValue is null and allLabel is set', () => {
      const wrapper = mountCombobox({ modelValue: null, allLabel: 'All eligible cohorts' })
      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('All eligible cohorts')
    })

    it('shows nothing when modelValue is null and no allLabel is set', () => {
      const wrapper = mountCombobox({ modelValue: null })
      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('')
    })
  })

  describe('opening the list', () => {
    it('does not render the listbox until focused', () => {
      mountCombobox()
      expect(document.body.querySelector('[role="listbox"]')).toBeNull()
    })

    it('renders every option on focus', async () => {
      const wrapper = mountCombobox()
      await open(wrapper)
      const rows = document.body.querySelectorAll('[role="option"]')
      expect(rows).toHaveLength(OPTIONS.length)
    })

    it('prefixes the list with allLabel as its own option when set', async () => {
      const wrapper = mountCombobox({ allLabel: 'All cohorts' })
      await open(wrapper)
      const rows = document.body.querySelectorAll('[role="option"]')
      expect(rows).toHaveLength(OPTIONS.length + 1)
      expect(rows[0]!.textContent).toBe('All cohorts')
    })
  })

  describe('filtering', () => {
    it('narrows options to those matching the typed query, case-insensitively', async () => {
      const wrapper = mountCombobox()
      await open(wrapper)
      await wrapper.find('input').setValue('beta')
      const rows = document.body.querySelectorAll('[role="option"]')
      expect(rows).toHaveLength(1)
      expect(rows[0]!.textContent).toBe('Cohort Beta')
    })

    it('shows emptyText when nothing matches', async () => {
      const wrapper = mountCombobox({ emptyText: 'No cohorts match' })
      await open(wrapper)
      await wrapper.find('input').setValue('zzz-no-match')
      expect(document.body.querySelector('.vcb-empty')?.textContent).toBe('No cohorts match')
      expect(document.body.querySelectorAll('[role="option"]')).toHaveLength(0)
    })
  })

  describe('selection', () => {
    it('emits update:modelValue with the option id on click', async () => {
      const wrapper = mountCombobox()
      await open(wrapper)
      const rows = document.body.querySelectorAll('[role="option"]')
      rows[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['c2'])
    })

    it('emits null when the allLabel option is clicked', async () => {
      const wrapper = mountCombobox({ modelValue: 'c1', allLabel: 'All cohorts' })
      await open(wrapper)
      const rows = document.body.querySelectorAll('[role="option"]')
      rows[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null])
    })

    it('closes the list after a selection', async () => {
      const wrapper = mountCombobox()
      await open(wrapper)
      const rows = document.body.querySelectorAll('[role="option"]')
      rows[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
      expect(document.body.querySelector('[role="listbox"]')).toBeNull()
    })
  })

  describe('keyboard', () => {
    it('ArrowDown then Enter selects the next option', async () => {
      const wrapper = mountCombobox()
      await open(wrapper)
      const input = wrapper.find('input')
      await input.trigger('keydown', { key: 'ArrowDown' })
      await input.trigger('keydown', { key: 'Enter' })
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['c2'])
    })

    it('Escape closes the list without emitting a selection', async () => {
      const wrapper = mountCombobox()
      await open(wrapper)
      await wrapper.find('input').trigger('keydown', { key: 'Escape' })
      await nextTick()
      expect(document.body.querySelector('[role="listbox"]')).toBeNull()
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })
  })

  describe('accessibility', () => {
    it('input has role="combobox"', () => {
      const wrapper = mountCombobox()
      expect(wrapper.find('input').attributes('role')).toBe('combobox')
    })

    it('aria-expanded reflects open state', async () => {
      const wrapper = mountCombobox()
      expect(wrapper.find('input').attributes('aria-expanded')).toBe('false')
      await open(wrapper)
      expect(wrapper.find('input').attributes('aria-expanded')).toBe('true')
    })

    it('aria-controls points at the rendered listbox id', async () => {
      const wrapper = mountCombobox()
      await open(wrapper)
      const controls = wrapper.find('input').attributes('aria-controls')
      expect(document.getElementById(controls!)).not.toBeNull()
    })
  })
})
