import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppTopbar from '@/components/layout/AppTopbar.vue'

const defaultProps = {
  crumb: 'Dashboard',
  userName: 'David Kim',
  userRole: 'Admin',
  userInitials: 'DK',
}

describe('AppTopbar', () => {
  it('renders the crumb as the current breadcrumb label', () => {
    const wrapper = mount(AppTopbar, { props: defaultProps })
    expect(wrapper.find('.crumbs .cur').text()).toBe('Dashboard')
  })

  it('renders the role badge', () => {
    const wrapper = mount(AppTopbar, { props: defaultProps })
    expect(wrapper.find('.role-badge').text()).toBe('Admin')
  })

  it('renders user initials in the avatar', () => {
    const wrapper = mount(AppTopbar, { props: defaultProps })
    expect(wrapper.find('.avatar').text()).toBe('DK')
  })

  it('does not show user name for Admin role', () => {
    const wrapper = mount(AppTopbar, { props: defaultProps })
    expect(wrapper.find('.topbar-name').exists()).toBe(false)
  })

  it('shows user name for Instructor role', () => {
    const wrapper = mount(AppTopbar, {
      props: { ...defaultProps, userRole: 'Instructor', userName: 'Sarah Jenkins' },
    })
    expect(wrapper.find('.topbar-name').text()).toBe('Sarah Jenkins')
  })

  it('updates the crumb label when prop changes', async () => {
    const wrapper = mount(AppTopbar, { props: defaultProps })
    await wrapper.setProps({ crumb: 'Cohorts' })
    expect(wrapper.find('.crumbs .cur').text()).toBe('Cohorts')
  })
})
