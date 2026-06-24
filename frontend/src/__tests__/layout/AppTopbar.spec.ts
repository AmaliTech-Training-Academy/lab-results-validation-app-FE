import { describe, it, expect } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import AppTopbar from '@/components/layout/AppTopbar.vue'

const defaultProps = {
  crumb: 'Dashboard',
  homeRoute: 'admin-dashboard',
  userName: 'David Kim',
  userRole: 'Admin',
  userInitials: 'DK',
}

const mountTopbar = (props: Record<string, string> = {}) =>
  mount(AppTopbar, {
    props: { ...defaultProps, ...props },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })

describe('AppTopbar', () => {
  it('renders the crumb as the current breadcrumb label', () => {
    const wrapper = mountTopbar()
    expect(wrapper.find('.crumbs .cur').text()).toBe('Dashboard')
  })

  it('renders a home link pointing to the homeRoute', () => {
    const wrapper = mountTopbar()
    const link = wrapper.findComponent(RouterLinkStub)
    expect(link.props('to')).toEqual({ name: 'admin-dashboard' })
    expect(link.text()).toBe('Home')
  })

  it('renders user initials in the avatar', () => {
    const wrapper = mountTopbar()
    expect(wrapper.find('.avatar').text()).toBe('DK')
  })

  it('does not show user name for Admin role', () => {
    const wrapper = mountTopbar()
    expect(wrapper.find('.topbar-name').exists()).toBe(false)
  })

  it('shows user name for Instructor role', () => {
    const wrapper = mountTopbar({ userRole: 'Instructor', userName: 'Sarah Jenkins' })
    expect(wrapper.find('.topbar-name').text()).toBe('Sarah Jenkins')
  })

  it('updates the crumb label when prop changes', async () => {
    const wrapper = mountTopbar()
    await wrapper.setProps({ crumb: 'Cohorts' })
    expect(wrapper.find('.crumbs .cur').text()).toBe('Cohorts')
  })

  it('toggles the profile menu and emits logout when Logout is clicked', async () => {
    const wrapper = mountTopbar()
    // Menu is closed initially
    expect(wrapper.find('.profile-menu').exists()).toBe(false)

    await wrapper.find('.profile-btn').trigger('click')
    expect(wrapper.find('.profile-menu').exists()).toBe(true)

    const logoutItem = wrapper
      .findAll('.profile-item')
      .find((el) => el.text().includes('Logout'))
    await logoutItem?.trigger('click')
    expect(wrapper.emitted('logout')).toHaveLength(1)
  })
})
