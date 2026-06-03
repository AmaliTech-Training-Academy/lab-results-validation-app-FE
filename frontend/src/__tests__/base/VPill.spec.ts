import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VPill from '@/components/base/VPill.vue'

describe('VPill', () => {
  it('renders slot content', () => {
    const wrapper = mount(VPill, { slots: { default: 'Completed' } })
    expect(wrapper.text()).toBe('Completed')
  })

  it('always has the pill class', () => {
    const wrapper = mount(VPill)
    expect(wrapper.classes()).toContain('pill')
  })

  it('defaults to info tone', () => {
    const wrapper = mount(VPill)
    expect(wrapper.classes()).toContain('pill-info')
  })

  it.each([
    ['success', 'pill-success'],
    ['warning', 'pill-warning'],
    ['danger',  'pill-danger'],
    ['info',    'pill-info'],
  ] as const)('applies pill-%s class for tone="%s"', (tone, cls) => {
    const wrapper = mount(VPill, { props: { tone } })
    expect(wrapper.classes()).toContain(cls)
  })

  it('renders as a span', () => {
    const wrapper = mount(VPill)
    expect(wrapper.element.tagName.toLowerCase()).toBe('span')
  })
})
