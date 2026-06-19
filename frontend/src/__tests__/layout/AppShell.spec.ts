import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppShell from '@/components/layout/AppShell.vue'

const defaultProps = {
  role: 'admin' as const,
  activeId: 'a-dashboard',
  crumb: 'Dashboard',
  userName: 'David Kim',
  userRole: 'Admin',
  userInitials: 'DK',
}

describe('AppShell', () => {
  it('renders the sidebar', () => {
    const wrapper = mount(AppShell, { props: defaultProps })
    expect(wrapper.find('.sidebar').exists()).toBe(true)
  })

  it('renders the topbar', () => {
    const wrapper = mount(AppShell, { props: defaultProps })
    expect(wrapper.find('.topbar').exists()).toBe(true)
  })

  it('renders default slot content inside the container', () => {
    const wrapper = mount(AppShell, {
      props: defaultProps,
      slots: { default: '<p class="slot-content">Page content</p>' },
    })
    expect(wrapper.find('.container .slot-content').exists()).toBe(true)
    expect(wrapper.find('.slot-content').text()).toBe('Page content')
  })

  it('passes the crumb to the topbar', () => {
    const wrapper = mount(AppShell, { props: { ...defaultProps, crumb: 'Cohorts' } })
    expect(wrapper.find('.crumbs .cur').text()).toBe('Cohorts')
  })

  it('passes the role to the sidebar', () => {
    const instructorWrapper = mount(AppShell, {
      props: { ...defaultProps, role: 'instructor', activeId: 'i-dashboard', userRole: 'Instructor' },
    })
    // Instructor sidebar has 4 nav items, not 7
    expect(instructorWrapper.findAll('.nav .nav-item')).toHaveLength(4)
  })

  it('bubbles navigate event from the sidebar', async () => {
    const wrapper = mount(AppShell, { props: defaultProps })
    const reportsBtn = wrapper
      .findAll('.nav .nav-item')
      .find((el) => el.text().includes('Reports'))
    await reportsBtn?.trigger('click')
    expect(wrapper.emitted('navigate')?.[0]).toEqual(['a-reports'])
  })

  it('bubbles logout event from the topbar profile menu', async () => {
    const wrapper = mount(AppShell, { props: defaultProps })
    // Open the profile dropdown, then click Logout
    await wrapper.find('.profile-btn').trigger('click')
    const logoutItem = wrapper
      .findAll('.profile-item')
      .find((el) => el.text().includes('Logout'))
    await logoutItem?.trigger('click')
    expect(wrapper.emitted('logout')).toHaveLength(1)
  })
})
