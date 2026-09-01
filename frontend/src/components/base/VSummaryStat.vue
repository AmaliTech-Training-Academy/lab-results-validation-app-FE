<script setup lang="ts">
import VIcon from './VIcon.vue'

withDefaults(
  defineProps<{
    label: string
    value: string | number
    icon?: string
    tone?: 'info' | 'success' | 'warning' | 'neutral' | 'danger'
  }>(),
  {
    tone: 'neutral',
  },
)
</script>

<template>
  <div class="summary-stat" :class="`tone-${tone}`">
    <div v-if="icon" class="summary-stat-chip"><VIcon :name="icon" :size="16" /></div>
    <dt>{{ label }}</dt>
    <dd class="mono">{{ value }}</dd>
  </div>
</template>

<style scoped>
.summary-stat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md, 6px);
  padding: 16px;
  box-shadow: var(--shadow-card);
}
.summary-stat dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}
.summary-stat dd {
  font-size: 24px;
  font-weight: 600;
  color: var(--text);
  margin-top: 2px;
}
.summary-stat-chip {
  width: 32px;
  height: 32px;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}
.tone-info .summary-stat-chip { background: var(--info-bg); color: var(--info); }
.tone-success .summary-stat-chip { background: var(--success-bg); color: var(--success); }
.tone-warning .summary-stat-chip { background: var(--warning-bg); color: var(--warning); }
.tone-neutral .summary-stat-chip { background: var(--bg); color: var(--text-secondary); }
.tone-danger .summary-stat-chip { background: var(--danger-bg); color: var(--danger); }
.tone-danger dd { color: var(--danger); }
.tone-warning dd { color: var(--warning); }
</style>
