<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { changePasswordApi, resetPasswordApi } from '@/services/auth.service'
import { toErrorMessage } from '@/utils/errors'
import { useToastStore } from '@/stores/toast'
import { usePasswordVisibility } from '@/composables/usePasswordVisibility'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import logoUrl from '@/assets/validata-logo.webp'
import patternUrl from '@/assets/reset-pattern.webp'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const toast = useToastStore()

const resetToken = computed(() => route.query.token as string | undefined)
const isResetFlow = computed(() => !!resetToken.value)

const password = ref('')
const confirmPassword = ref('')
const {
  inputType: passwordInputType,
  icon: passwordIcon,
  ariaLabel: passwordAriaLabel,
  toggle: togglePassword,
} = usePasswordVisibility()
const {
  inputType: confirmInputType,
  icon: confirmIcon,
  ariaLabel: confirmAriaLabel,
  toggle: toggleConfirm,
} = usePasswordVisibility()
const passwordTouched = ref(false)
const confirmTouched = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

const hasDigit = (p: string) => /[0-9]/.test(p)
const hasSymbol = (p: string) => /[^a-zA-Z0-9]/.test(p)

// Weighted on character diversity (lower/upper/digit/symbol), not just length —
// an all-lowercase password can never score above "Weak", however long it is.
const score = computed(() => {
  const p = password.value
  if (!p) return 0
  const hasLower = /[a-z]/.test(p)
  const hasUpper = /[A-Z]/.test(p)
  const diversity = [hasLower, hasUpper, hasDigit(p), hasSymbol(p)].filter(Boolean).length
  if (p.length < 8 || diversity <= 1) return 1
  if (diversity === 2) return 2
  if (diversity === 3) return p.length >= 12 ? 4 : 3
  return p.length >= 10 ? 4 : 3
})

const SCORE_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']
const SCORE_COLORS = ['var(--danger)', 'var(--orange)', 'var(--orange)', 'var(--success)']

const passwordError = computed(() => {
  if (!passwordTouched.value) return ''
  if (password.value.length < 8) return 'Password must be at least 8 characters'
  if (!hasDigit(password.value) || !hasSymbol(password.value)) {
    return 'Password must include at least one number and one symbol'
  }
  return ''
})

const confirmError = computed(() => {
  if (!confirmTouched.value || !confirmPassword.value) return ''
  if (password.value !== confirmPassword.value) return 'Passwords do not match'
  return ''
})

const isFormValid = computed(
  () =>
    password.value.length >= 8 &&
    hasDigit(password.value) &&
    hasSymbol(password.value) &&
    password.value === confirmPassword.value,
)

async function submit() {
  passwordTouched.value = true
  confirmTouched.value = true
  if (!isFormValid.value) return

  error.value = null
  isLoading.value = true
  try {
    if (isResetFlow.value) {
      await resetPasswordApi(resetToken.value!, password.value)
      toast.show({ tone: 'success', title: 'Password reset', body: 'Your password has been updated. Please sign in.' })
      router.push({ name: 'login' })
    } else {
      const response = await changePasswordApi(auth.tempPassword ?? '', password.value)
      auth.completedPasswordSetup(response.token)
      toast.show({ tone: 'success', title: 'Password set', body: 'Your password has been set. Welcome!' })
      router.push({ name: 'admin-dashboard' })
    }
  } catch (err) {
    const msg = toErrorMessage(err, '')
    error.value = msg || 'Failed to set password. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="reset-page">
    <!-- Decorative pattern side, with the brand logo -->
    <aside
      class="reset-aside"
      :style="{ backgroundImage: `url(${patternUrl})` }"
      aria-hidden="true"
    />

    <!-- Form side -->
    <main class="reset-main">
      <form class="reset-form" novalidate @submit.prevent="submit">
        <img :src="logoUrl" alt="Validata" class="brand-logo" width="1172" height="220" />

        <h1 class="auth-title">{{ isResetFlow ? 'Reset your password' : 'Set your password' }}</h1>
        <p class="auth-sub">{{ isResetFlow ? 'Enter a new password for your account.' : 'This is your first login. Choose a secure password to continue.' }}</p>

        <!-- New password -->
        <div class="field">
          <label for="setpw-new">New password</label>
          <div :class="['input', { 'input--error': passwordError }]">
            <input
              id="setpw-new"
              v-model="password"
              :type="passwordInputType"
              placeholder="Enter your new password"
              autocomplete="new-password"
              :aria-describedby="`setpw-strength${passwordError ? ' setpw-new-error' : ''}`"
              :aria-invalid="!!passwordError"
              @blur="passwordTouched = true"
            />
            <button
              type="button"
              class="trail"
              :aria-label="passwordAriaLabel"
              @click="togglePassword"
            >
              <VIcon :name="passwordIcon" :size="18" />
            </button>
          </div>
          <span
            v-if="passwordError"
            id="setpw-new-error"
            class="field-error"
            role="alert"
          >
            <VIcon name="alert-circle" :size="13" />
            {{ passwordError }}
          </span>
        </div>

        <!-- Strength meter -->
        <div id="setpw-strength" aria-live="polite" aria-atomic="true">
          <div class="strength-head">
            <span class="ff-label">Password strength</span>
            <span
              v-if="score > 0"
              class="strength-label"
              :style="{ color: SCORE_COLORS[score - 1] }"
            >
              {{ SCORE_LABELS[score] }}
            </span>
          </div>
          <div class="strength-bars" role="presentation">
            <span
              v-for="i in 4"
              :key="i"
              class="strength-bar"
              :style="{
                background: i <= score ? SCORE_COLORS[Math.max(score - 1, 0)] : '#E4E2DA',
              }"
            />
          </div>
          <p class="ff-hint" style="margin-top: 8px">
            Must be at least 8 characters with numbers and symbols.
          </p>
        </div>

        <!-- Confirm password -->
        <div class="field">
          <label for="setpw-confirm">Confirm password</label>
          <div :class="['input', { 'input--error': confirmError }]">
            <input
              id="setpw-confirm"
              v-model="confirmPassword"
              :type="confirmInputType"
              placeholder="Re-enter your password"
              autocomplete="new-password"
              :aria-describedby="confirmError ? 'setpw-confirm-error' : undefined"
              :aria-invalid="!!confirmError"
              @blur="confirmTouched = true"
            />
            <button
              type="button"
              class="trail"
              :aria-label="confirmAriaLabel"
              @click="toggleConfirm"
            >
              <VIcon :name="confirmIcon" :size="18" />
            </button>
          </div>
          <span
            v-if="confirmError"
            id="setpw-confirm-error"
            class="field-error"
            role="alert"
          >
            <VIcon name="alert-circle" :size="13" />
            {{ confirmError }}
          </span>
        </div>

        <!-- API-level error -->
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <VButton
          type="submit"
          variant="primary"
          style="width: 100%"
          :disabled="isLoading"
          :aria-busy="isLoading"
        >
          {{ isLoading ? 'Saving…' : isResetFlow ? 'Reset password' : 'Set password &amp; continue' }}
        </VButton>

        <RouterLink to="/login" class="back-link">Back to sign in</RouterLink>
      </form>
    </main>
  </div>
</template>

<style scoped>
.reset-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
}

/* ---------- Pattern side ---------- */
.reset-aside {
  position: relative;
  background-color: var(--navy);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  padding: 40px;
}
/* Brand logo — centered on the white form side, prominent */
.brand-logo {
  display: block;
  width: 180px;
  height: auto;
  margin: 0 auto 24px;
}

/* ---------- Form side ---------- */
.reset-main {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  padding: 40px 24px;
  overflow-y: auto;
}
.reset-form {
  width: 100%;
  max-width: 400px;
}

.auth-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 20px;
  line-height: 26px;
  text-align: center;
  color: var(--text);
  margin: 0 0 6px;
}
.auth-sub {
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 20px;
  margin: 0 auto 28px;
}

/* Labels — matches the sign-up page */
.field { margin-bottom: 22px; }
.field label {
  color: var(--text);
  font-weight: 600;
  font-size: 14px;
}

/* Dark-navy primary button — identical to the sign-up page */
.reset-form :deep(.btn) {
  width: 100%;
  height: 52px;
  border-radius: 10px;
  font-size: 16px;
  background: var(--navy);
  color: #fff;
}
.reset-form :deep(.btn:hover) { background: var(--navy-2); }
.reset-form :deep(.btn:disabled) { background: var(--navy); opacity: 0.5; }

/* Strength meter spacing */
#setpw-strength { margin-bottom: 22px; }

/* Back link */
.back-link {
  display: block;
  text-align: center;
  margin-top: 20px;
  color: var(--text-secondary);
  text-decoration: underline;
  font-size: 13px;
  font-weight: 500;
}
.back-link:hover { color: var(--navy); }
</style>
