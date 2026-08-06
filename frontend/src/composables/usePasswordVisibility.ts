import { ref, computed } from 'vue'

/** Show/hide state for a password field's trailing eye toggle — repeated across every auth form's password input(s). */
export function usePasswordVisibility() {
  const visible = ref(false)
  const inputType = computed(() => (visible.value ? 'text' : 'password'))
  const icon = computed(() => (visible.value ? 'eye-off' : 'eye'))
  const ariaLabel = computed(() => (visible.value ? 'Hide password' : 'Show password'))

  function toggle() {
    visible.value = !visible.value
  }

  return { visible, inputType, icon, ariaLabel, toggle }
}
