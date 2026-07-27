import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VButton from '@/components/base/VButton.vue'

describe('VButton', () => {
  it('renders slot content', () => {
    const wrapper = mount(VButton, { slots: { default: 'Save changes' } })
    expect(wrapper.text()).toContain('Save changes')
  })

  it('always has the btn class', () => {
    const wrapper = mount(VButton)
    expect(wrapper.classes()).toContain('btn')
  })

  it('defaults to primary variant', () => {
    const wrapper = mount(VButton)
    expect(wrapper.classes()).toContain('btn-primary')
    expect(wrapper.classes()).not.toContain('btn-ghost')
    expect(wrapper.classes()).not.toContain('btn-danger')
  })

  it.each([
    ['primary', 'btn-primary'],
    ['ghost',   'btn-ghost'],
    ['danger',  'btn-danger'],
  ] as const)('applies btn-%s class for variant="%s"', (variant, cls) => {
    const wrapper = mount(VButton, { props: { variant } })
    expect(wrapper.classes()).toContain(cls)
  })

  it('adds btn-sm class for size sm', () => {
    const wrapper = mount(VButton, { props: { size: 'sm' } })
    expect(wrapper.classes()).toContain('btn-sm')
  })

  it('does not add btn-sm for size md', () => {
    const wrapper = mount(VButton, { props: { size: 'md' } })
    expect(wrapper.classes()).not.toContain('btn-sm')
  })

  it('defaults type to button', () => {
    const wrapper = mount(VButton)
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('forwards type prop to the button element', () => {
    const wrapper = mount(VButton, { props: { type: 'submit' } })
    expect(wrapper.attributes('type')).toBe('submit')
  })

  it('sets the disabled attribute when disabled is true', () => {
    const wrapper = mount(VButton, { props: { disabled: true } })
    expect((wrapper.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('emits click when clicked', async () => {
    const wrapper = mount(VButton)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('emits the native MouseEvent on click', async () => {
    const wrapper = mount(VButton)
    await wrapper.trigger('click')
    const [event] = wrapper.emitted('click')![0] as [MouseEvent]
    expect(event).toBeInstanceOf(MouseEvent)
  })

  it('renders a leading icon svg when icon prop is set', () => {
    const wrapper = mount(VButton, { props: { icon: 'upload-cloud' } })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('renders a trailing icon svg when iconRight prop is set', () => {
    const wrapper = mount(VButton, { props: { iconRight: 'arrow-right' } })
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('renders no svg when neither icon nor iconRight are set', () => {
    const wrapper = mount(VButton, { slots: { default: 'Label only' } })
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('does not emit click when the button is disabled', async () => {
    const wrapper = mount(VButton, { props: { disabled: true } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})
