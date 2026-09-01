<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VEmptyState from '@/components/base/VEmptyState.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VTablePager from '@/components/base/VTablePager.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { useCohortsStore } from '@/stores/cohorts'
import { useReferenceStore } from '@/stores/reference'
import { useToastStore } from '@/stores/toast'
import { toErrorMessage } from '@/utils/errors'
import { PAGE_SIZE_OPTIONS } from '@/utils/pagination'
import { loadPageSize, savePageSize } from '@/utils/uiPrefs'
import { cohortDisplayState, COHORT_STATE_CHIP } from '@/types/domain.types'
import type { SpecializationWithModules } from '@/types/domain.types'

usePageTitle('Cohort detail')

const route = useRoute()
const cohorts = useCohortsStore()
const reference = useReferenceStore()
const toast = useToastStore()

const cohortId = route.params.id as string
const cohort = computed(() => cohorts.current)
const ref_ = computed(() => reference.reference)
const loadError = computed(() => {
  const errors = [reference.error, cohorts.error].filter((e): e is string => !!e)
  return errors.length ? errors.join(' ') : null
})

const chip = computed(() => (cohort.value ? COHORT_STATE_CHIP[cohortDisplayState(cohort.value)] : null))

/** learner.specializationId → specialization name, for the roster table. */
const specName = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  ref_.value?.specializations.forEach((s) => (map[s.id] = s.name))
  return map
})

// ── Reference hierarchy: collapsed specializations, capped module list ────────
const MODULE_PAGE_SIZE = 8
const expandedSpecs = ref<Set<string>>(new Set())
const showAllModules = ref<Set<string>>(new Set())
const moduleSearch = ref<Record<string, string>>({})

function toggleSpec(id: string) {
  const next = new Set(expandedSpecs.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedSpecs.value = next
}

const allSpecsExpanded = computed(() => {
  const specs = ref_.value?.specializations ?? []
  return specs.length > 0 && specs.every((s) => expandedSpecs.value.has(s.id))
})

function toggleAllSpecs() {
  const specs = ref_.value?.specializations ?? []
  expandedSpecs.value = allSpecsExpanded.value ? new Set() : new Set(specs.map((s) => s.id))
}

function revealAllModules(id: string) {
  showAllModules.value = new Set(showAllModules.value).add(id)
}

function visibleModules(spec: SpecializationWithModules) {
  const q = (moduleSearch.value[spec.id] ?? '').trim().toLowerCase()
  const all = q
    ? spec.modules.filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q))
    : spec.modules
  const capped = showAllModules.value.has(spec.id) || q ? all : all.slice(0, MODULE_PAGE_SIZE)
  return { all, capped }
}

const counts = computed(() => {
  const r = ref_.value
  if (!r) return null
  const modules = r.specializations.flatMap((s) => s.modules)
  return {
    specializations: r.specializations.length,
    modules: modules.length,
    labs: modules.reduce((n, m) => n + m.labs.length, 0),
    learners: r.learners.length,
    instructors: r.instructors.length,
  }
})

// The reference endpoint returns the whole learner/instructor roster in one payload (no server
// pagination) — a large cohort would otherwise render every row as unvirtualized DOM. Page it
// client-side instead; each table gets its own page cursor and its own persisted page size.
function usePage<T>(items: () => T[], pageSizeKey: string) {
  const pageSize = ref(loadPageSize(pageSizeKey, 25, PAGE_SIZE_OPTIONS))
  watch(pageSize, (size) => savePageSize(pageSizeKey, size))

  const page = ref(1)
  const total = computed(() => items().length)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  const safePage = computed(() => Math.min(Math.max(page.value, 1), totalPages.value))
  const paged = computed(() => items().slice((safePage.value - 1) * pageSize.value, safePage.value * pageSize.value))
  return { page, pageSize, safePage, paged, total }
}
const learnersPage = usePage(() => ref_.value?.learners ?? [], 'validata.cohortDetail.learnersPageSize')
const instructorsPage = usePage(() => ref_.value?.instructors ?? [], 'validata.cohortDetail.instructorsPageSize')

async function loadCohort() {
  await Promise.all([cohorts.fetchCohort(cohortId), reference.fetchReference(cohortId)])
}
onMounted(loadCohort)

async function toggleLock() {
  if (!cohort.value) return
  const wasLocked = cohort.value.locked
  try {
    if (wasLocked) await cohorts.unlock(cohortId)
    else await cohorts.lock(cohortId)
    toast.show({ tone: 'success', title: wasLocked ? 'Cohort unlocked' : 'Cohort locked' })
  } catch (e) {
    toast.show({ tone: 'warning', title: 'Action failed', body: toErrorMessage(e, 'Please try again.') })
  }
}
</script>

<template>
  <div class="page-head">
    <div>
      <RouterLink :to="{ name: 'admin-cohorts' }" class="back-link">
        <VIcon name="chevron-left" :size="15" /> Cohorts
      </RouterLink>
      <h1 class="page-title">
        {{ cohort?.name ?? '…' }}
        <VPill v-if="chip" :tone="chip.tone">{{ chip.label }}</VPill>
      </h1>
      <p class="page-sub">Committed reference data — read-only and frozen for the life of the cohort.</p>
    </div>
    <VButton
      v-if="cohort?.lifecycleState === 'STOOD_UP'"
      :variant="cohort.locked ? 'ghost' : 'primary'"
      :icon="cohort.locked ? 'lock-open' : 'lock'"
      @click="toggleLock"
    >
      {{ cohort.locked ? 'Unlock cohort' : 'Lock cohort' }}
    </VButton>
  </div>

  <div v-if="reference.loading" class="muted">Loading reference data…</div>

  <div v-else-if="loadError" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load this cohort</p>
    <p class="load-error-sub">{{ loadError }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="loadCohort">Try again</VButton>
  </div>

  <template v-else-if="ref_">
    <!-- Summary counts -->
    <dl v-if="counts" class="summary">
      <div class="summary-cell"><dt>Specializations</dt><dd class="mono">{{ counts.specializations }}</dd></div>
      <div class="summary-cell"><dt>Modules</dt><dd class="mono">{{ counts.modules }}</dd></div>
      <div class="summary-cell"><dt>Labs</dt><dd class="mono">{{ counts.labs }}</dd></div>
      <div class="summary-cell"><dt>Learners</dt><dd class="mono">{{ counts.learners }}</dd></div>
      <div class="summary-cell"><dt>Instructors</dt><dd class="mono">{{ counts.instructors }}</dd></div>
    </dl>

    <!-- Hierarchy: specialization → modules → labs -->
    <section class="block">
      <div class="block-head">
        <div>
          <h2 class="block-title">Reference hierarchy</h2>
          <p class="block-sub">Browse the committed structure of this cohort.</p>
        </div>
        <VButton variant="ghost" size="sm" :icon="allSpecsExpanded ? 'chevron-up' : 'chevron-down'" @click="toggleAllSpecs">
          {{ allSpecsExpanded ? 'Collapse all' : 'Expand all' }}
        </VButton>
      </div>
      <div v-for="spec in ref_.specializations" :key="spec.id" class="spec-card">
        <button type="button" class="spec-head" @click="toggleSpec(spec.id)">
          <VIcon name="folder" :size="16" class="muted" />
          <span class="spec-name">{{ spec.name }}</span>
          <span class="code-tag mono">{{ spec.code }}</span>
          <span class="spec-count mono">{{ spec.modules.length }} modules</span>
          <VIcon :name="expandedSpecs.has(spec.id) ? 'chevron-up' : 'chevron-down'" :size="16" class="muted" />
        </button>

        <div v-if="expandedSpecs.has(spec.id)" class="spec-body">
          <div v-if="spec.modules.length > MODULE_PAGE_SIZE" class="module-search">
            <VIcon name="search" :size="14" class="muted" />
            <input v-model="moduleSearch[spec.id]" type="text" placeholder="Search modules…" />
          </div>

          <div v-for="mod in visibleModules(spec).capped" :key="mod.id" class="module">
            <div class="module-head">
              <VIcon name="file-text" :size="14" class="muted" />
              <span class="module-name">{{ mod.name }}</span>
              <span class="code-tag mono">{{ mod.code }}</span>
            </div>
            <ul class="lab-list">
              <li v-for="lab in mod.labs" :key="lab.id" class="lab-row">
                <VIcon name="flask-conical" :size="14" class="muted" />
                <span class="lab-title">{{ lab.title }}</span>
                <span class="lab-max mono">max {{ lab.maxScore }}</span>
              </li>
            </ul>
          </div>

          <p v-if="visibleModules(spec).all.length === 0" class="module-empty">No modules match your search.</p>

          <div v-if="!showAllModules.has(spec.id) && !moduleSearch[spec.id] && spec.modules.length > MODULE_PAGE_SIZE" class="module-more">
            <span class="muted">Showing {{ MODULE_PAGE_SIZE }} of {{ spec.modules.length }} modules</span>
            <button type="button" class="view-all-link" @click="revealAllModules(spec.id)">
              View all {{ spec.modules.length }} modules →
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Learners -->
    <section class="block">
      <h2 class="block-title">Learners <span class="count-badge mono">{{ ref_.learners.length }}</span></h2>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Specialization</th><th style="text-align: center">Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="l in learnersPage.paged.value" :key="l.id">
              <td style="font-weight: 500">{{ l.fullName }}</td>
              <td class="mono muted">{{ l.email }}</td>
              <td>{{ specName[l.specializationId] ?? '—' }}</td>
              <td style="text-align: center">
                <VPill :tone="l.status === 'active' ? 'success' : 'info'">{{ l.status === 'active' ? 'Active' : 'Archived' }}</VPill>
              </td>
            </tr>
            <tr v-if="learnersPage.paged.value.length === 0">
              <td colspan="4">
                <VEmptyState
                  icon="users"
                  title="No learners yet"
                  description="This cohort's reference data has no learner roster."
                />
              </td>
            </tr>
          </tbody>
        </table>

        <VTablePager
          v-if="learnersPage.total.value > 0"
          :total="learnersPage.total.value"
          :page="learnersPage.safePage.value"
          :page-size="learnersPage.pageSize.value"
          @update:page="(p) => (learnersPage.page.value = p)"
          @update:page-size="(s) => (learnersPage.pageSize.value = s)"
        />
      </div>
    </section>

    <!-- Instructor contacts -->
    <section class="block">
      <h2 class="block-title">Instructor contacts <span class="count-badge mono">{{ ref_.instructors.length }}</span></h2>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr><th>Name</th><th>Email</th><th style="text-align: center">Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="ins in instructorsPage.paged.value" :key="ins.id">
              <td style="font-weight: 500">{{ ins.fullName }}</td>
              <td class="mono muted">{{ ins.email }}</td>
              <td style="text-align: center">
                <VPill :tone="ins.active ? 'success' : 'info'">{{ ins.active ? 'Active' : 'Inactive' }}</VPill>
              </td>
            </tr>
            <tr v-if="instructorsPage.paged.value.length === 0">
              <td colspan="3">
                <VEmptyState
                  icon="user-round"
                  title="No instructor contacts yet"
                  description="This cohort's reference data has no instructor contacts."
                />
              </td>
            </tr>
          </tbody>
        </table>

        <VTablePager
          v-if="instructorsPage.total.value > 0"
          :total="instructorsPage.total.value"
          :page="instructorsPage.safePage.value"
          :page-size="instructorsPage.pageSize.value"
          @update:page="(p) => (instructorsPage.page.value = p)"
          @update:page-size="(s) => (instructorsPage.pageSize.value = s)"
        />
      </div>
    </section>
  </template>
</template>

<style scoped>
.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.page-sub {
  color: var(--text-secondary);
  font-size: 14px;
  margin-top: 4px;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}
.back-link:hover {
  color: var(--navy);
}
.muted {
  color: var(--text-secondary);
}

.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 28px;
}
.summary-cell {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md, 6px);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
}
.summary-cell dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}
.summary-cell dd {
  font-size: 24px;
  font-weight: 600;
  color: var(--text);
  margin-top: 2px;
}

.block {
  margin-bottom: 32px;
}
.block-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.block-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 16px;
  color: var(--text);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.count-badge {
  font-size: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 8px;
  color: var(--text-secondary);
}

.block-sub {
  color: var(--text-secondary);
  font-size: 14px;
  margin: -8px 0 14px;
}

.spec-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md, 6px);
  overflow: hidden;
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
}
.spec-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}
.spec-head:hover {
  background: var(--bg);
}
.spec-name {
  font-weight: 600;
  font-size: 15px;
}
.spec-count {
  margin-left: auto;
  font-size: 13px;
  color: var(--text-secondary);
}
.code-tag {
  font-size: 11px;
  background: var(--bg);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 2px 7px;
  letter-spacing: 0.03em;
}
.spec-body {
  padding: 0 16px 16px;
  border-top: 1px solid var(--border-soft, var(--border));
}
.module-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0;
  padding: 0 12px;
  height: 38px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: #fff;
  max-width: 320px;
}
.module-search input {
  border: none;
  outline: none;
  flex: 1;
  font-family: inherit;
  font-size: 14px;
  background: transparent;
}
.module-empty {
  color: var(--text-secondary);
  font-size: 14px;
  padding: 12px 0;
}
.module-more {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  margin-top: 4px;
  border-top: 1px solid var(--border-soft, var(--border));
  font-size: 13px;
}
.view-all-link {
  background: none;
  border: none;
  color: var(--navy);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}
.view-all-link:hover {
  text-decoration: underline;
}
.module {
  position: relative;
  margin: 14px 0 14px 24px;
}
.module:first-child {
  margin-top: 0;
}
.module::before {
  /* trunk line dropping from the specialization header down to this module's dot */
  content: '';
  position: absolute;
  top: -18px;
  left: -20px;
  width: 1px;
  height: 27px;
  background: var(--border);
}
.module::after {
  /* branch dot where this module meets the trunk */
  content: '';
  position: absolute;
  top: 9px;
  left: -22px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--border);
}
.module-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.module-name {
  font-weight: 500;
}
.module-head .code-tag {
  background: var(--bg);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.lab-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 4px;
}
.lab-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  margin-left: 20px;
  font-size: 14px;
}
.lab-row::before {
  /* short drop from the module row, curving into the lab row */
  content: '';
  position: absolute;
  top: -8px;
  left: -13px;
  width: 8px;
  height: 18px;
  border-left: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  border-bottom-left-radius: 6px;
}
.lab-title {
  flex: 1;
}
.lab-max {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
