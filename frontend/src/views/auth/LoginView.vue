<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { loginApi } from '@/services/auth.service'
import { toErrorMessage } from '@/utils/errors'
import { useAllowedEmailDomain } from '@/composables/useAllowedEmailDomain'
import { usePasswordVisibility } from '@/composables/usePasswordVisibility'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import logoUrl from '@/assets/validata-logo.png'
import amaliLogoUrl from '@/assets/amalitech-logo.svg'
import bgUrl from '@/assets/signup-picture.png'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const { inputType: passwordInputType, icon: passwordIcon, ariaLabel: passwordAriaLabel, toggle: togglePassword } = usePasswordVisibility()
const emailTouched = ref(false)
const passwordTouched = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

const { emailError, isEmailValid } = useAllowedEmailDomain(email, emailTouched)

const passwordError = computed(() => {
  if (!passwordTouched.value) return ''
  if (!password.value) return 'Password is required.'
  if (password.value.length < 8) return 'Password must be at least 8 characters'
  return ''
})

const isPasswordValid = computed(() => password.value.length >= 8)

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

    router.push('/admin/dashboard')
  } catch (err) {
    const msg = toErrorMessage(err, '')
    error.value = msg === 'Account is disabled'
      ? 'Your account has been disabled. Please contact your administrator.'
      : 'Invalid email or password.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div
    class="auth-page"
    :style="{ backgroundImage: `linear-gradient(rgba(8,40,59,0.6), rgba(8,40,59,0.6)), url(${bgUrl})` }"
  >
    <form class="auth-card" novalidate @submit.prevent="submit">
      <!-- Brand lockup: AmaliTech (parent) above Validata (product) -->
      <div class="brand-stack">
        <img :src="amaliLogoUrl" alt="AmaliTech" class="brand-amali" />
        <span class="brand-divider" aria-hidden="true" />
        <img :src="logoUrl" alt="Validata" class="brand-logo" />
      </div>

      <h1 class="auth-title">Sign In</h1>
      <p class="auth-sub">Enter your email and password to access your account</p>

      <!-- Email -->
      <div class="field">
        <label for="login-email">Email</label>
        <div :class="['input', { 'input--error': emailError }]">
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
        <span v-if="emailError" id="login-email-error" class="field-error" role="alert">
          <VIcon name="alert-circle" :size="13" />
          {{ emailError }}
        </span>
      </div>

      <!-- Password -->
      <div class="field">
        <label for="login-password">Password</label>
        <div :class="['input', { 'input--error': passwordError }]">
          <span class="lead" aria-hidden="true"><VIcon name="lock" :size="17" /></span>
          <input
            id="login-password"
            v-model="password"
            :type="passwordInputType"
            placeholder="••••••••••"
            autocomplete="current-password"
            :aria-describedby="passwordError ? 'login-password-error' : undefined"
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
        <span v-if="passwordError" id="login-password-error" class="field-error" role="alert">
          <VIcon name="alert-circle" :size="13" />
          {{ passwordError }}
        </span>
      </div>

      <div class="forgot-row">
        <RouterLink to="/forgot-password" class="link">Forgot Password?</RouterLink>
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
        {{ isLoading ? 'Signing in…' : 'Sign In' }}
      </VButton>

      <div class="auth-foot">
        <a class="link link--muted" href="#" @click.prevent>Contact Support</a>
      </div>
    </form>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #08283b;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  padding: 24px;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(8, 40, 59, 0.08);
  padding: 44px 40px;
}

/* Brand lockup */
.brand-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin: 0 0 26px;
}
/* AmaliTech — secondary parent brand, smaller and slightly muted */
.brand-amali {
  display: block;
  width: 118px;
  height: auto;
  opacity: 0.85;
}
/* Hairline divider between the two brands */
.brand-divider {
  width: 44px;
  height: 1px;
  background: var(--border);
}
/* Validata — primary product brand, the hero */
.brand-logo {
  display: block;
  width: 172px;
  height: auto;
}

.auth-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 26px;
  line-height: 32px;
  text-align: center;
  color: var(--text);
  margin: 0 0 8px;
}
.auth-sub {
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 20px;
  margin: 0 auto 28px;
  max-width: 300px;
}

/* Labels — darker + medium weight */
.field { margin-bottom: 18px; }
.field label {
  color: var(--text);
  font-weight: 600;
  font-size: 14px;
}

/* Filled, rounded inputs */
.input {
  height: 50px;
  background: #efeff1;
  border: 1px solid #e4e5e9;
  border-radius: 10px;
}
.input:focus-within {
  border-color: var(--navy);
  box-shadow: 0 0 0 3px rgba(8, 40, 59, 0.12);
}
/* The wrapper above shows the focus state — drop the inner field's navy
   focus-visible outline so there's no double (navy) ring. */
.input input:focus-visible {
  outline: none;
}

/* Forgot password — right-aligned, muted */
.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin: -4px 0 22px;
}
.forgot-row .link {
  color: var(--text-secondary);
  font-weight: 500;
}
.forgot-row .link:hover { color: var(--navy); }

/* Full-width, larger primary action button for the auth card (color comes
   from the shared .btn-primary default — no local override needed). */
.auth-card :deep(.btn) {
  width: 100%;
  height: 52px;
  border-radius: 10px;
  font-size: 16px;
}

.auth-foot {
  margin-top: 20px;
  text-align: center;
}
.auth-foot .link {
  color: var(--text-secondary);
  text-decoration: underline;
  font-size: 13px;
  font-weight: 500;
}
.auth-foot .link:hover { color: var(--navy); }
</style>
