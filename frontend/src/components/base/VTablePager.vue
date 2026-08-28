<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VIcon from './VIcon.vue'
import { pagerItems, PAGE_SIZE_OPTIONS } from '@/utils/pagination'

/**
 * Shared pagination footer: result range + rows-per-page select + bounded page
 * numbers with ellipsis. Replaces the three slightly-different hand-rolled
 * pagers (Cohorts had different size options and no "Showing X to Y", Learners
 * rendered every page number unbounded).
 */
const props = withDefaults(
  defineProps<{
    total: number
    /** 1-based current page. */
    page: number
    pageSize: number
    /** Push page changes into the URL when provided. */
    queryKey?: string
    disabled?: boolean
  }>(),
  { queryKey: undefined, disabled: false },
)

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: number]
}>()

const route = useRoute()
const router = useRouter()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / Math.max(props.pageSize, 1))))
const items = computed(() => pagerItems(props.page, totalPages.value))
const showingFrom = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const showingTo = computed(() => Math.min(props.total, props.page * props.pageSize))

function goTo(page: number) {
  if (page < 1 || page > totalPages.value || page === props.page) return
  emit('update:page', page)
  syncUrl(page)
}

function onSizeChange(e: Event) {
  const size = Number((e.target as HTMLSelectElement).value)
  emit('update:pageSize', size)
  // Keep the range roughly stable instead of landing on an empty page.
  const firstItem = (props.page - 1) * props.pageSize + 1
  emit('update:page', Math.max(1, Math.ceil(firstItem / size)))
}

function syncUrl(page: number) {
  if (!props.queryKey) return
  const next = { ...route.query }
  if (page <= 1) delete next[props.queryKey]
  else next[props.queryKey] = String(page)
  router.replace({ query: next }).catch(() => {})
}
</script>

<template>
  <div class="pager">
    <span class="pager-count" aria-live="polite">
      Showing <span class="pg-strong">{{ showingFrom }}</span> to
      <span class="pg-strong">{{ showingTo }}</span> of
      <span class="pg-strong">{{ total }}</span> Entries
    </span>
    <div class="pager-right">
      <div class="pgsize">
        <select :value="pageSize" :disabled="disabled" aria-label="Rows per page" @change="onSizeChange">
          <option v-for="n in PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }} per page</option>
        </select>
      </div>
      <nav class="pager-ctrls" aria-label="Pagination">
        <button class="pg-arrow" aria-label="Previous page" :disabled="disabled || page === 1" @click="goTo(page - 1)">
          <VIcon name="chevron-left" :size="16" />
        </button>
        <template v-for="item in items" :key="item.kind === 'page' ? item.page : item.key">
          <span v-if="item.kind === 'ellipsis'" class="pg-ellipsis" aria-hidden="true">…</span>
          <button
            v-else
            :class="['pg-num', { on: page === item.page }]"
            :aria-current="page === item.page ? 'page' : undefined"
            :disabled="disabled"
            @click="goTo(item.page)"
          >
            {{ item.page }}
          </button>
        </template>
        <button class="pg-arrow" aria-label="Next page" :disabled="disabled || page >= totalPages" @click="goTo(page + 1)">
          <VIcon name="chevron-right" :size="16" />
        </button>
      </nav>
    </div>
  </div>
</template>
