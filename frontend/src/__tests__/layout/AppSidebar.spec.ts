import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const adminProps = { role: 'admin' as const, activeId: 'a-dashboard' }
const instructorProps = { role: 'instructor' as const, activeId: 'i-dashboard' }

describe('AppSidebar', () => {
  describe('brand', () => {
    it('renders the Validata brand name', () => {
      const wrapper = mount(AppSidebar, { props: adminProps })
      expect(wrapper.find('.brand .name').text()).toBe('Validata')
    })

    it('renders the Internal Tool subtitle', () => {
      const wrapper = mount(AppSidebar, { props: adminProps })
      expect(wrapper.find('.brand .sub').text()).toBe('Internal Tool')
    })
  })

  describe('admin role', () => {
    it('renders all 7 admin nav items', () => {
      const wrapper = mount(AppSidebar, { props: adminProps })
      const navItems = wrapper.findAll('.nav .nav-item')
      expect(navItems).toHaveLength(7)
    })

    it('renders the Settings footer item', () => {
      const wrapper = mount(AppSidebar, { props: adminProps })
      const footItems = wrapper.findAll('.nav-foot .nav-item')
      // Settings + Logout
      expect(footItems).toHaveLength(2)
      expect(footItems[0]!.text()).toContain('Settings')
    })

    it('renders all expected admin nav labels', () => {
      const wrapper = mount(AppSidebar, { props: adminProps })
      const labels = wrapper.findAll('.nav .nav-item').map((el) => el.text())
      expect(labels).toContain('Dashboard')
      expect(labels).toContain('Cohorts')
      expect(labels).toContain('Reference Data')
      expect(labels).toContain('Learners')
      expect(labels).toContain('User Management')
      expect(labels).toContain('Reports')
      expect(labels).toContain('Power BI')
    })
  })

  describe('instructor role', () => {
    it('renders all 4 instructor nav items', () => {
      const wrapper = mount(AppSidebar, { props: instructorProps })
      const navItems = wrapper.findAll('.nav .nav-item')
      expect(navItems).toHaveLength(4)
    })

    it('renders no footer nav items (only Logout)', () => {
      const wrapper = mount(AppSidebar, { props: instructorProps })
      const footItems = wrapper.findAll('.nav-foot .nav-item')
      expect(footItems).toHaveLength(1)
      expect(footItems[0]!.text()).toContain('Logout')
    })

    it('renders all expected instructor nav labels', () => {
      const wrapper = mount(AppSidebar, { props: instructorProps })
      const labels = wrapper.findAll('.nav .nav-item').map((el) => el.text())
      expect(labels).toContain('Dashboard')
      expect(labels).toContain('Download Template')
      expect(labels).toContain('Upload Results')
      expect(labels).toContain('My Uploads')
    })
  })

  describe('active state', () => {
    it('marks the active nav item with the active class', () => {
      const wrapper = mount(AppSidebar, { props: { role: 'admin' as const, activeId: 'a-cohorts' } })
      const activeItem = wrapper.find('.nav-item.active')
      expect(activeItem.text()).toContain('Cohorts')
    })

    it('does not mark other nav items as active', () => {
      const wrapper = mount(AppSidebar, { props: adminProps })
      const activeItems = wrapper.findAll('.nav-item.active')
      expect(activeItems).toHaveLength(1)
    })
  })

  describe('events', () => {
    it('emits navigate with the item id when a nav item is clicked', async () => {
      const wrapper = mount(AppSidebar, { props: adminProps })
      const cohortsBtn = wrapper
        .findAll('.nav .nav-item')
        .find((el) => el.text().includes('Cohorts'))
      await cohortsBtn?.trigger('click')
      expect(wrapper.emitted('navigate')?.[0]).toEqual(['a-cohorts'])
    })

    it('emits logout when the Logout button is clicked', async () => {
      const wrapper = mount(AppSidebar, { props: adminProps })
      const logoutBtn = wrapper
        .findAll('.nav-item')
        .find((el) => el.text().includes('Logout'))
      await logoutBtn?.trigger('click')
      expect(wrapper.emitted('logout')).toHaveLength(1)
    })

    it('emits navigate with the footer item id when a footer nav item is clicked', async () => {
      const wrapper = mount(AppSidebar, { props: adminProps })
      const settingsBtn = wrapper
        .findAll('.nav-foot .nav-item')
        .find((el) => el.text().includes('Settings'))
      await settingsBtn?.trigger('click')
      expect(wrapper.emitted('navigate')?.[0]).toEqual(['a-settings'])
    })
  })

  describe('reactivity', () => {
    it('moves the active class when activeId prop changes', async () => {
      const wrapper = mount(AppSidebar, { props: adminProps })
      expect(wrapper.find('.nav-item.active').text()).toContain('Dashboard')
      await wrapper.setProps({ activeId: 'a-reports' })
      expect(wrapper.find('.nav-item.active').text()).toContain('Reports')
    })
  })
})
