<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { loginApi } from '@/services/auth.service'
import AuthBrandPanel from '@/components/auth/AuthBrandPanel.vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const emailTouched = ref(false)
const passwordTouched = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)
const currentYear = new Date().getFullYear()

const ALLOWED_DOMAINS = ['amalitech.com', 'amalitechtraining.com', 'amalitechtraining.org']

const emailError = computed(() => {
  if (!emailTouched.value || !email.value) return ''
  const domain = email.value.split('@')[1]?.toLowerCase()
  if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
    return 'Email must be from @amalitech.com, @amalitechtraining.com, or @amalitechtraining.org'
  }
  return ''
})

const isEmailValid = computed(() => {
  const domain = email.value.split('@')[1]?.toLowerCase()
  return !!domain && ALLOWED_DOMAINS.includes(domain)
})

const passwordError = computed(() => {
  if (!passwordTouched.value || !password.value) return ''
  if (password.value.length < 8) return 'Password must be at least 8 characters'
  return ''
})

const isPasswordValid = computed(() => password.value.length >= 8)

const features = [
  { icon: 'shield-check', title: 'Strict validation',  sub: 'Multi-tier verification engine' },
  { icon: 'scroll-text',  title: 'Audit trail',         sub: 'Immutable logs for every action' },
  { icon: 'line-chart',   title: 'Power BI ready',      sub: 'Direct export for analytics tools' },
]

async function submit() {
  emailTouched.value = true
  passwordTouched.value = true
  if (!isEmailValid.value || !isPasswordValid.value) return

  error.value = null
  isLoading.value = true
  try {
    const response = await loginApi(email.value, password.value)
    auth.login(response, password.value)

    if (response.mustChangePassword) {
      router.push({ name: 'set-password' })
      return
    }

    const redirect = route.query.redirect as string | undefined
    if (redirect) {
      router.push(redirect)
      return
    }

    router.push(auth.isAdmin ? '/admin/dashboard' : '/instructor/dashboard')
  } catch {
    error.value = 'Invalid email or password.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login">
    <AuthBrandPanel tagline="The single source of truth for lab results validation and internal data auditing.">
      <div class="lb-features">
        <div v-for="f in features" :key="f.title" class="lb-feature">
          <div class="lb-fic">
            <VIcon :name="f.icon" :size="20" color="#fff" />
          </div>
          <div>
            <div class="lb-ftitle">{{ f.title }}</div>
            <div class="lb-fsub">{{ f.sub }}</div>
          </div>
        </div>
      </div>

      <template #foot>
        © {{ currentYear }} Lab Results Validator. Internal Tooling
      </template>
    </AuthBrandPanel>

    <div class="login-form-pane">
      <form class="login-card" novalidate @submit.prevent="submit">
        <div class="lc-head">
          <h1 class="lc-title">Sign in</h1>
          <p class="lc-sub">Access the internal lab results dashboard</p>
        </div>

        <!-- Email -->
        <div class="field">
          <label for="login-email">Email address</label>
          <div
            :class="['input', { 'input--error': emailError }]"
            :aria-invalid="!!emailError"
          >
            <span class="lead" aria-hidden="true"><VIcon name="mail" :size="17" /></span>
            <input
              id="login-email"
              v-model="email"
              type="email"
              placeholder="name@amalitech.com"
              autocomplete="email"
              :aria-describedby="emailError ? 'login-email-error' : undefined"
              :aria-invalid="!!emailError"
              @blur="emailTouched = true"
            />
          </div>
          <span
            v-if="emailError"
            id="login-email-error"
            class="field-error"
            role="alert"
          >
            <VIcon name="alert-circle" :size="13" />
            {{ emailError }}
          </span>
        </div>

        <!-- Password -->
        <div class="field">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <label for="login-password">Password</label>
            <a class="link" href="#" @click.prevent>Forgot password?</a>
          </div>
          <div :class="['input', { 'input--error': passwordError }]">
            <span class="lead" aria-hidden="true"><VIcon name="lock" :size="17" /></span>
            <input
              id="login-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              :aria-describedby="passwordError ? 'login-password-error' : undefined"
              :aria-invalid="!!passwordError"
              @blur="passwordTouched = true"
            />
            <button
              type="button"
              class="trail"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <VIcon :name="showPassword ? 'eye-off' : 'eye'" :size="18" />
            </button>
          </div>
          <span
            v-if="passwordError"
            id="login-password-error"
            class="field-error"
            role="alert"
          >
            <VIcon name="alert-circle" :size="13" />
            {{ passwordError }}
          </span>
        </div>

        <!-- API-level error -->
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <VButton
          type="submit"
          variant="primary"
          icon-right="arrow-right"
          style="width: 100%"
          :disabled="isLoading"
          :aria-busy="isLoading"
        >
          {{ isLoading ? 'Signing in…' : 'Sign in' }}
        </VButton>

        <div class="lc-foot">
          First time here?
          <RouterLink to="/set-password" class="link">Set your password</RouterLink>
          · Contact your administrator if you don't have an account.
        </div>
      </form>

      <div class="lc-secure" aria-hidden="true">
        <VIcon name="shield" :size="12" />
        SECURE 256-BIT ENCRYPTED SESSION
      </div>
    </div>
  </div>
</template>
