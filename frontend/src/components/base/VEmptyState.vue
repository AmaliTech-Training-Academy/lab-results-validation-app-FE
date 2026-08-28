<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import VButton from './VButton.vue'
import VIcon from './VIcon.vue'
import type { RouteLocationRaw } from 'vue-router'

/**
 * Rich empty state for tables/lists: icon, title, description and an optional
 * action. Exists because LearnersView/MyUploads had bare "No learners found."
 * text while other pages shipped a full designed block — one component ends
 * that drift.
 */
const props = withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
    /** Optional action button (renders only when provided). */
    actionLabel?: string
    /** Where the action navigates; omit to emit `action` instead. */
    to?: RouteLocationRaw
  }>(),
  { icon: 'inbox', description: undefined, actionLabel: undefined, to: undefined },
)

const emit = defineEmits<{ action: [] }>()
const router = useRouter()
const hasAction = computed(() => !!props.actionLabel)

function onAction() {
  if (props.to) {
    router.push(props.to)
  }
  emit('action')
}
</script>

<template>
  <div class="empty-inline">
    <div class="empty-inline-icon"><VIcon :name="icon" :size="24" /></div>
    <p class="empty-title">{{ title }}</p>
    <p v-if="description" class="empty-sub">{{ description }}</p>
    <VButton v-if="hasAction" size="sm" variant="primary" @click="onAction">
      {{ actionLabel }}
    </VButton>
  </div>
</template>

<style scoped>
.empty-inline-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--bg);
  color: var(--text-secondary);
}
</style>
