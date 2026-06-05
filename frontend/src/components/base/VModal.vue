<script setup lang="ts">
import VIcon from './VIcon.vue'

defineProps<{
  open: boolean
  title: string
  subtitle?: string
  tone?: 'warning'
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-scrim" @click="$emit('close')">
      <div class="modal" @click.stop>
        <div class="modal-head">
          <span v-if="tone === 'warning'" class="modal-ic">
            <VIcon name="alert-triangle" :size="22" />
          </span>
          <div>
            <h2 class="modal-title">{{ title }}</h2>
            <p v-if="subtitle" class="modal-sub">{{ subtitle }}</p>
          </div>
        </div>
        <div class="modal-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="modal-foot">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
