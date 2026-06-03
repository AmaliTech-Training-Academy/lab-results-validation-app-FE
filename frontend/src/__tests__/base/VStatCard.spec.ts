import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VStatCard from '@/components/base/VStatCard.vue'

const defaultProps = {
  label: 'Total rows evaluated',
  value: '1,248',
  chipIcon: 'layers',
  chipBg: '#FFE9E3',
  chipFg: '#A83900',
  footDot: '#1A6B3C',
  footText: 'Last upload 2 hours ago',
}

describe('VStatCard', () => {
  it('renders the label', () => {
    const wrapper = mount(VStatCard, { props: defaultProps })
    expect(wrapper.find('.stat-cap').text()).toBe('Total rows evaluated')
  })

  it('renders the value', () => {
    const wrapper = mount(VStatCard, { props: defaultProps })
    expect(wrapper.find('.stat-num').text()).toBe('1,248')
  })

  it('renders the footer text', () => {
    const wrapper = mount(VStatCard, { props: defaultProps })
    expect(wrapper.find('.stat-foot').text()).toContain('Last upload 2 hours ago')
  })

  it('applies chipBg and chipFg as inline styles on the chip', () => {
    const wrapper = mount(VStatCard, { props: defaultProps })
    const chip = wrapper.find('.stat-chip')
    expect(chip.attributes('style')).toContain('background: rgb(255, 233, 227)')
    expect(chip.attributes('style')).toContain('color: rgb(168, 57, 0)')
  })

  it('applies footDot color as inline style on the dot', () => {
    const wrapper = mount(VStatCard, { props: defaultProps })
    const dot = wrapper.find('.dot')
    expect(dot.attributes('style')).toContain('background: rgb(26, 107, 60)')
  })

  it('renders a chip icon svg', () => {
    const wrapper = mount(VStatCard, { props: defaultProps })
    expect(wrapper.find('.stat-chip svg').exists()).toBe(true)
  })

  it('has the stat wrapper class', () => {
    const wrapper = mount(VStatCard, { props: defaultProps })
    expect(wrapper.classes()).toContain('stat')
  })
})
