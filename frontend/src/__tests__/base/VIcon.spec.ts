import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VIcon from '@/components/base/VIcon.vue'

describe('VIcon', () => {
  it('renders an svg for a known icon name', () => {
    const wrapper = mount(VIcon, { props: { name: 'microscope' } })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('renders nothing for an unknown icon name', () => {
    const wrapper = mount(VIcon, { props: { name: 'this-icon-does-not-exist' } })
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('converts kebab-case name to the correct Lucide component', () => {
    // layout-dashboard → LayoutDashboard
    const wrapper = mount(VIcon, { props: { name: 'layout-dashboard' } })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('passes the size prop to the underlying icon', () => {
    const wrapper = mount(VIcon, { props: { name: 'microscope', size: 24 } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('24')
    expect(svg.attributes('height')).toBe('24')
  })

  it('defaults size to 18', () => {
    const wrapper = mount(VIcon, { props: { name: 'microscope' } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('18')
  })

  it('resolves icon names with numeric segments (bar-chart-2 → BarChart2)', () => {
    const wrapper = mount(VIcon, { props: { name: 'bar-chart-2' } })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('emits a console.warn in dev mode for an unknown icon name', () => {
    const warns: string[] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => warns.push(String(args[0]))
    mount(VIcon, { props: { name: 'not-a-real-icon' } })
    console.warn = original
    expect(warns.some((w) => w.includes('not-a-real-icon'))).toBe(true)
  })
})
