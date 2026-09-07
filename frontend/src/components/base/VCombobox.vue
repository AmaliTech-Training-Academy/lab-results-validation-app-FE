<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount, useId } from 'vue'
import VIcon from './VIcon.vue'

export interface ComboboxOption {
  id: string
  label: string
}

/**
 * Searchable single-select. Behaves like a native <select> (v-model, keyboard-operable, one value
 * out) but lets the user type to filter instead of scanning/scrolling a flat option list — built for
 * pickers backed by lists that can grow past what's comfortable in a plain dropdown (e.g. cohorts).
 */
const props = withDefaults(
  defineProps<{
    modelValue: string | null
    options: ComboboxOption[]
    label?: string
    placeholder?: string
    /** Label for a leading "no selection" option (e.g. "All eligible cohorts"). Omit to require a real pick. */
    allLabel?: string
    required?: boolean
    error?: string
    emptyText?: string
  }>(),
  { placeholder: 'Search…', emptyText: 'No matches' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

interface ListOption {
  id: string
  label: string
  isAll: boolean
}

const listboxId = useId()
const root = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const open = ref(false)
const query = ref('')
const activeIndex = ref(-1)
const pos = ref<{ top: number; left: number; width: number } | null>(null)

const selectedLabel = computed(() => {
  if (props.modelValue === null) return props.allLabel ?? ''
  return props.options.find((o) => o.id === props.modelValue)?.label ?? ''
})

// Shows the in-progress query while open (so typing is visible), the selected label once closed.
const displayValue = computed(() => (open.value ? query.value : selectedLabel.value))

const filtered = computed((): ListOption[] => {
  const q = query.value.trim().toLowerCase()
  const matches = q ? props.options.filter((o) => o.label.toLowerCase().includes(q)) : props.options
  const rows: ListOption[] = matches.map((o) => ({ id: o.id, label: o.label, isAll: false }))
  if (props.allLabel && (!q || props.allLabel.toLowerCase().includes(q))) {
    rows.unshift({ id: '', label: props.allLabel, isAll: true })
  }
  return rows
})

function position() {
  if (!root.value) return
  const r = root.value.getBoundingClientRect()
  pos.value = { top: r.bottom + 4, left: r.left, width: r.width }
}

function openList() {
  if (open.value) return
  open.value = true
  query.value = ''
  const idx = filtered.value.findIndex((o) => (o.isAll ? props.modelValue === null : o.id === props.modelValue))
  activeIndex.value = Math.max(0, idx)
  nextTick(position)
}

function closeList() {
  open.value = false
  activeIndex.value = -1
  query.value = ''
}

function select(opt: ListOption) {
  emit('update:modelValue', opt.isAll ? null : opt.id)
  // Focus while still open, before closeList() — @focus="openList" no-ops via its own `if (open.value)
  // return` guard here, but would reopen the list if this ran after closing.
  inputEl.value?.focus()
  closeList()
}

function onInput(e: Event) {
  if (!open.value) openList()
  query.value = (e.target as HTMLInputElement).value
  activeIndex.value = 0
}

function scrollActiveIntoView() {
  nextTick(() => {
    const el = listEl.value?.querySelector<HTMLElement>(`[data-index="${activeIndex.value}"]`)
    el?.scrollIntoView?.({ block: 'nearest' })
  })
}

function move(delta: number) {
  if (!open.value) {
    openList()
    return
  }
  const n = filtered.value.length
  if (n === 0) return
  activeIndex.value = (activeIndex.value + delta + n) % n
  scrollActiveIntoView()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(-1)
  } else if (e.key === 'Enter') {
    const active = open.value && activeIndex.value >= 0 ? filtered.value[activeIndex.value] : undefined
    if (active) {
      e.preventDefault()
      select(active)
    }
  } else if (e.key === 'Escape') {
    if (open.value) {
      e.stopPropagation()
      closeList()
    }
  } else if (e.key === 'Tab') {
    closeList()
  }
}

function onDocClick(e: MouseEvent) {
  const t = e.target as Node
  if (root.value?.contains(t) || listEl.value?.contains(t)) return
  closeList()
}

function reposition() {
  if (open.value) position()
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('click', onDocClick)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
  } else {
    document.removeEventListener('click', onDocClick)
    window.removeEventListener('scroll', reposition, true)
    window.removeEventListener('resize', reposition)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('scroll', reposition, true)
  window.removeEventListener('resize', reposition)
})
</script>

<template>
  <label class="ff">
    <span v-if="label" class="ff-label">{{ label }}<span v-if="required" style="color: var(--danger)"> *</span></span>
    <div ref="root" :class="['vcb', { 'vcb--error': error }]">
      <input
        ref="inputEl"
        type="text"
        class="vcb-input"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-controls="listboxId"
        :aria-activedescendant="open && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined"
        :placeholder="placeholder"
        :value="displayValue"
        autocomplete="off"
        @focus="openList"
        @input="onInput"
        @keydown="onKeydown"
      />
      <VIcon name="chevron-down" :size="16" class="vcb-caret" />
    </div>
    <span v-if="error" class="field-error" style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--danger)">
      <VIcon name="alert-circle" :size="13" />{{ error }}
    </span>
  </label>
  <Teleport to="body">
    <ul
      v-if="open && pos"
      :id="listboxId"
      ref="listEl"
      role="listbox"
      class="vcb-list"
      :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${pos.width}px` }"
    >
      <li v-if="filtered.length === 0" class="vcb-empty">{{ emptyText }}</li>
      <!-- .stop: this listbox is teleported to <body>, same as VPopover's own panel — an unstopped
           click would bubble past it and read as an "outside click" to any ancestor VPopover this
           combobox is nested inside (e.g. a filter popover), closing it before `select()` runs. -->
      <li
        v-for="(opt, i) in filtered"
        :id="`${listboxId}-opt-${i}`"
        :key="opt.isAll ? '__all__' : opt.id"
        :data-index="i"
        role="option"
        :aria-selected="opt.isAll ? modelValue === null : opt.id === modelValue"
        :class="['pop-row', 'vcb-option', { 'vcb-option--active': i === activeIndex }]"
        @click.stop="select(opt)"
        @mouseenter="activeIndex = i"
      >
        {{ opt.label }}
      </li>
    </ul>
  </Teleport>
</template>

<style scoped>
.vcb {
  position: relative;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.vcb:focus-within {
  border-color: var(--navy);
  box-shadow: var(--ring-focus);
}
.vcb--error {
  border-color: var(--danger);
}
.vcb--error:focus-within {
  box-shadow: 0 0 0 3px rgba(163, 45, 45, 0.2);
}
.vcb-input {
  border: none;
  outline: none;
  flex: 1;
  min-width: 0;
  font-family: inherit;
  font-size: 15px;
  color: var(--text);
  background: transparent;
}
.vcb-caret {
  color: rgba(90, 104, 112, 0.7);
  flex-shrink: 0;
  pointer-events: none;
}
</style>

<style>
/* Unscoped: the listbox is teleported to <body>, outside this component's scoped-style boundary. */
.vcb-list {
  position: fixed;
  z-index: var(--z-popover);
  max-height: 260px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-pop);
  padding: 4px;
  margin: 0;
  list-style: none;
}
.vcb-empty {
  padding: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}
.vcb-option--active {
  background: var(--bg);
}
</style>
