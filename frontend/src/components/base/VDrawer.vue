<script setup lang="ts">
import VIcon from './VIcon.vue'

defineProps<{
  open: boolean
  title: string
  subtitle?: string
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="drawer-scrim" @click="$emit('close')">
      <div class="drawer" @click.stop>
        <div class="drawer-head">
          <div>
            <h2 class="drawer-title">{{ title }}</h2>
            <p v-if="subtitle" class="drawer-sub">{{ subtitle }}</p>
          </div>
          <button class="drawer-x" aria-label="Close" @click="$emit('close')">
            <VIcon name="x" :size="20" />
          </button>
        </div>
        <div class="drawer-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="drawer-foot">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
