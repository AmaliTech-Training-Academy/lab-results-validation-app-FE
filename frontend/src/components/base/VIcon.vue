<script setup lang="ts">
import { computed } from 'vue'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Eye,
  EyeOff,
  Flag,
  FlaskConical,
  FolderTree,
  GitMerge,
  Info,
  Layers,
  LayoutDashboard,
  Link,
  Loader,
  Lock,
  LockOpen,
  LogOut,
  Mail,
  Microscope,
  MinusCircle,
  Monitor,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Send,
  Settings,
  ShieldX,
  Trash2,
  WifiOff,
  X,
  XCircle,
} from '@lucide/vue'

/**
 * Explicit name → component registry (rather than `import * as icons`) so
 * Rollup can tree-shake everything from @lucide/vue except what's actually
 * used — the wildcard import was pulling the entire 1000+ icon package into
 * the production bundle, fetched on every page load.
 */
const ICONS: Record<string, unknown> = {
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  'arrow-right': ArrowRight,
  calendar: Calendar,
  check: Check,
  'check-circle': CheckCircle,
  'check-circle-2': CheckCircle2,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  circle: Circle,
  'clipboard-check': ClipboardCheck,
  eye: Eye,
  'eye-off': EyeOff,
  flag: Flag,
  'flask-conical': FlaskConical,
  'folder-tree': FolderTree,
  'git-merge': GitMerge,
  info: Info,
  layers: Layers,
  'layout-dashboard': LayoutDashboard,
  link: Link,
  loader: Loader,
  lock: Lock,
  'lock-open': LockOpen,
  'log-out': LogOut,
  mail: Mail,
  microscope: Microscope,
  'minus-circle': MinusCircle,
  monitor: Monitor,
  pencil: Pencil,
  plus: Plus,
  'refresh-cw': RefreshCw,
  'rotate-ccw': RotateCcw,
  'scroll-text': ScrollText,
  send: Send,
  settings: Settings,
  'shield-x': ShieldX,
  'trash-2': Trash2,
  'wifi-off': WifiOff,
  x: X,
  'x-circle': XCircle,
}

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    color?: string
  }>(),
  {
    size: 18,
    color: 'currentColor',
  },
)

const icon = computed(() => {
  const resolved = ICONS[props.name] ?? null
  if (import.meta.env.DEV && !resolved) {
    console.warn(`[VIcon] Unknown icon name: "${props.name}"`)
  }
  return resolved
})
</script>

<template>
  <component :is="icon" v-if="icon" :size="size" :color="color" aria-hidden="true" focusable="false" />
</template>
