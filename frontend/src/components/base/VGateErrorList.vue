<script setup lang="ts">
import { computed, ref } from 'vue'
import VIcon from './VIcon.vue'
import VPill from './VPill.vue'
import { useToastStore } from '@/stores/toast'
import { formatLocatedError } from '@/utils/errors'
import type { LocatedError } from '@/types/common.types'

/**
 * Renders gate/file failure errors in a scannable way instead of a flat dump:
 * ungrouped messages (Gate 1/2 — no file) render as a plain list; errors that
 * carry a `file` are grouped under a file header with a count pill, each long
 * group capped with a "show more" toggle. A rule-frequency strip surfaces
 * repeat offenders (e.g. "REF-DUP-EMAIL × 6") at a glance before the detail.
 */
const props = withDefaults(defineProps<{ errors: LocatedError[]; previewCount?: number }>(), {
  previewCount: 6,
})

const toast = useToastStore()
const expanded = ref<Set<string>>(new Set())

const general = computed(() => props.errors.filter((e) => !e.file))

interface FileGroup {
  file: string
  items: LocatedError[]
}
const fileGroups = computed<FileGroup[]>(() => {
  const order: string[] = []
  const byFile = new Map<string, LocatedError[]>()
  for (const e of props.errors) {
    if (!e.file) continue
    if (!byFile.has(e.file)) {
      byFile.set(e.file, [])
      order.push(e.file)
    }
    byFile.get(e.file)!.push(e)
  }
  return order.map((file) => ({ file, items: byFile.get(file)! }))
})

/** Repeat rules across 2+ errors, most frequent first — a quick "what kind of thing broke" scan. */
const ruleCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const e of props.errors) {
    if (!e.rule) continue
    counts.set(e.rule, (counts.get(e.rule) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
})

function visibleItems(group: FileGroup): LocatedError[] {
  if (expanded.value.has(group.file) || group.items.length <= props.previewCount) return group.items
  return group.items.slice(0, props.previewCount)
}
function toggle(file: string) {
  const next = new Set(expanded.value)
  if (next.has(file)) next.delete(file)
  else next.add(file)
  expanded.value = next
}

async function copyAll() {
  const lines = [
    ...general.value.map((e) => e.message),
    ...fileGroups.value.flatMap((g) => g.items.map((e) => `${g.file} — ${formatLocatedError(e)}`)),
  ]
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    toast.show({ tone: 'info', title: 'Copied to clipboard' })
  } catch {
    toast.show({ tone: 'warning', title: 'Could not copy', body: 'Your browser blocked clipboard access.' })
  }
}
</script>

<template>
  <div class="gate-errors">
    <ul v-if="general.length" class="err-list">
      <li v-for="(e, i) in general" :key="i" class="err-item">
        <VIcon name="alert-circle" :size="13" />
        <span>{{ e.message }}</span>
      </li>
    </ul>

    <div v-if="ruleCounts.length" class="rule-strip">
      <VPill v-for="[rule, count] in ruleCounts" :key="rule" tone="danger">{{ rule }} × {{ count }}</VPill>
    </div>

    <div v-for="group in fileGroups" :key="group.file" class="err-group">
      <div class="err-group-head">
        <VIcon name="file-text" :size="13" />
        <span class="err-group-file mono">{{ group.file }}</span>
        <VPill tone="danger">{{ group.items.length }} issue{{ group.items.length === 1 ? '' : 's' }}</VPill>
      </div>
      <ul class="err-list">
        <li v-for="(e, i) in visibleItems(group)" :key="i" class="err-item">
          <VIcon name="alert-circle" :size="13" />
          <span class="mono">{{ formatLocatedError(e) }}</span>
        </li>
      </ul>
      <button v-if="group.items.length > previewCount" type="button" class="err-toggle" @click="toggle(group.file)">
        {{ expanded.has(group.file) ? 'Show less' : `Show ${group.items.length - previewCount} more` }}
      </button>
    </div>

    <button v-if="errors.length > 1" type="button" class="err-copy" @click="copyAll">
      <VIcon name="copy" :size="13" /> Copy error log
    </button>
  </div>
</template>

<style scoped>
.gate-errors {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 8px 0;
}
.err-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.err-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12.5px;
  color: var(--danger);
  background: rgba(255, 255, 255, 0.5);
  padding: 6px 10px;
  border-radius: 3px;
}
.err-item :deep(svg) {
  flex: none;
  margin-top: 1px;
}

.rule-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.err-group {
  border: 1px solid rgba(163, 45, 45, 0.2);
  border-radius: var(--r-sm, 4px);
  padding: 10px;
}
.err-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  color: var(--text);
}
.err-group-file {
  flex: 1;
  font-size: 12.5px;
  font-weight: 500;
}

.err-toggle {
  background: none;
  border: none;
  padding: 6px 2px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--navy);
  cursor: pointer;
  align-self: flex-start;
}
.err-toggle:hover {
  text-decoration: underline;
}

.err-copy {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--r-sm, 4px);
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
}
.err-copy:hover {
  color: var(--text);
  border-color: var(--text-secondary);
}
</style>
