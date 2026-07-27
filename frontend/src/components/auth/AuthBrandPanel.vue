<script setup lang="ts">
import VIcon from '@/components/base/VIcon.vue'

defineProps<{
  tagline?: string
}>()
</script>

<template>
  <div class="login-brand">
    <div class="login-glow" />

    <div class="login-top">
      <div class="lb-head">
        <div class="lb-mark">
          <VIcon name="microscope" :size="24" color="#fff" />
        </div>
        <span class="lb-word">Validata</span>
      </div>
      <p v-if="tagline" class="lb-tag">{{ tagline }}</p>
    </div>

    <slot />

    <div v-if="$slots.foot" class="lb-foot">
      <slot name="foot" />
    </div>
  </div>
</template>
