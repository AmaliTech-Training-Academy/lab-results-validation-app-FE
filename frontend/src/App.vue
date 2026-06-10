<script setup lang="ts">
import VToast from '@/components/base/VToast.vue'
import VIcon from '@/components/base/VIcon.vue'
</script>

<template>
  <RouterView />
  <VToast />

  <!-- Shown via CSS on viewports < 1024 px -->
  <div class="desktop-guard" role="alert" aria-live="polite">
    <div class="desktop-guard-card">
      <div class="desktop-guard-brand">
        <div class="desktop-guard-mark">
          <VIcon name="microscope" :size="22" color="#fff" />
        </div>
        <span class="desktop-guard-name">Validata</span>
      </div>

      <div class="desktop-guard-icon-wrap">
        <VIcon name="monitor" :size="36" color="rgba(255,255,255,0.75)" />
      </div>

      <h1 class="desktop-guard-title">Desktop browser required</h1>

      <p class="desktop-guard-body">
        Validata is an internal tool designed for desktop use. Please open it on a desktop or
        laptop computer to access the full application.
      </p>

      <div class="desktop-guard-hint">
        <VIcon name="monitor" :size="13" color="currentColor" />
        Best experienced at 1024 px or wider
      </div>
    </div>
  </div>
</template>
