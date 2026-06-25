import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import UserManagementView from '@/views/admin/UserManagementView.vue'
import { getInstructors, getModuleGroups } from '@/services/user.service'
import type { PagedInstructors, InstructorUser, ModuleGroup } from '@/types/user.types'
import type { CreatedInstructor, AssignModulesResponse, RemoveModulesResponse } from '@/types/user.types'

vi.mock('@/services/user.service', () => ({
  getInstructors: vi.fn<() => Promise<PagedInstructors>>().mockResolvedValue({
    content: [], totalElements: 0, page: 0, size: 10, totalPages: 0, last: true,
  }),
  getModuleGroups: vi.fn<() => Promise<ModuleGroup[]>>().mockResolvedValue([]),
  addInstructor: vi.fn<() => Promise<CreatedInstructor>>(),
  assignInstructorModules: vi.fn<() => Promise<AssignModulesResponse>>(),
  removeInstructorModules: vi.fn<() => Promise<RemoveModulesResponse>>(),
  updateInstructor: vi.fn<() => Promise<InstructorUser>>(),
}))

function mountView() {
  return mount(UserManagementView, {
    global: { plugins: [createPinia()] },
  })
}

describe('UserManagementView — filters', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the email search input', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('.toolbar .search input').exists()).toBe(true)
  })

  it('renders the module filter dropdown', async () => {
    const wrapper = mountView()
    await flushPromises()
    const select = wrapper.find('.toolbar select')
    expect(select.exists()).toBe(true)
    expect(select.find('option[value=""]').text()).toBe('All Modules')
  })

  it('renders All / Active / Inactive status toggle buttons', async () => {
    const wrapper = mountView()
    await flushPromises()
    const btns = wrapper.findAll('.segtoggle-btn').map((b) => b.text())
    expect(btns).toContain('All')
    expect(btns).toContain('Active')
    expect(btns).toContain('Inactive')
  })

  it('calls getInstructors with active:true when Active is selected', async () => {
    const wrapper = mountView()
    await flushPromises()
    vi.mocked(getInstructors).mockClear()

    const activeBtn = wrapper.findAll('.segtoggle-btn').find((b) => b.text() === 'Active')!
    await activeBtn.trigger('click')
    await flushPromises()

    expect(vi.mocked(getInstructors)).toHaveBeenCalledWith(expect.objectContaining({ active: true }))
  })

  it('calls getInstructors with active:false when Inactive is selected', async () => {
    const wrapper = mountView()
    await flushPromises()
    vi.mocked(getInstructors).mockClear()

    const inactiveBtn = wrapper.findAll('.segtoggle-btn').find((b) => b.text() === 'Inactive')!
    await inactiveBtn.trigger('click')
    await flushPromises()

    expect(vi.mocked(getInstructors)).toHaveBeenCalledWith(expect.objectContaining({ active: false }))
  })

  it('calls getInstructors without active param when All is selected', async () => {
    const wrapper = mountView()
    await flushPromises()

    const activeBtn = wrapper.findAll('.segtoggle-btn').find((b) => b.text() === 'Active')!
    await activeBtn.trigger('click')
    await flushPromises()
    vi.mocked(getInstructors).mockClear()

    const allBtn = wrapper.findAll('.segtoggle-btn').find((b) => b.text() === 'All')!
    await allBtn.trigger('click')
    await flushPromises()

    const call = vi.mocked(getInstructors).mock.calls[0]![0]
    expect(call).not.toHaveProperty('active', true)
    expect(call).not.toHaveProperty('active', false)
  })

  it('calls getInstructors with moduleId when module filter changes', async () => {
    vi.mocked(getModuleGroups).mockResolvedValue([
      { specId: 's1', specName: 'Dev', cohortName: 'Cohort 1', modules: [{ id: 'm1', name: 'JavaScript' }] },
    ])
    const wrapper = mountView()
    await flushPromises()
    vi.mocked(getInstructors).mockClear()

    const select = wrapper.find('.toolbar select')
    await select.setValue('m1')
    await flushPromises()

    expect(vi.mocked(getInstructors)).toHaveBeenCalledWith(expect.objectContaining({ moduleId: 'm1' }))
  })

  it('does not show the clear filters button when no filters are active', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).not.toContain('Clear')
  })

  it('shows the clear filters button when a status filter is active', async () => {
    const wrapper = mountView()
    await flushPromises()

    const activeBtn = wrapper.findAll('.segtoggle-btn').find((b) => b.text() === 'Active')!
    await activeBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Clear')
  })

  it('clear filters resets the status to All and reloads', async () => {
    const wrapper = mountView()
    await flushPromises()

    const activeBtn = wrapper.findAll('.segtoggle-btn').find((b) => b.text() === 'Active')!
    await activeBtn.trigger('click')
    await flushPromises()
    vi.mocked(getInstructors).mockClear()

    const clearBtn = wrapper.findAll('button').find((b) => b.text().includes('Clear'))!
    await clearBtn.trigger('click')
    await flushPromises()

    expect(vi.mocked(getInstructors)).toHaveBeenCalledWith(expect.objectContaining({ active: undefined }))
    expect(wrapper.text()).not.toContain('Clear')
  })

  it('shows "No instructors match your filters" when filters are active and results are empty', async () => {
    const wrapper = mountView()
    await flushPromises()

    const activeBtn = wrapper.findAll('.segtoggle-btn').find((b) => b.text() === 'Active')!
    await activeBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('No instructors match your filters.')
  })

  it('shows "No instructors yet" when no filters are active and results are empty', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('No instructors yet. Add one to get started.')
  })
})
