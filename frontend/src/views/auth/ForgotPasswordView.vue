<script setup lang="ts">
import { ref, computed } from 'vue'
import { forgotPasswordApi } from '@/services/auth.service'
import AuthBrandPanel from '@/components/auth/AuthBrandPanel.vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'

const email = ref('')
const emailTouched = ref(false)
const isLoading = ref(false)
const submitted = ref(false)
const error = ref<string | null>(null)

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

async function submit() {
  emailTouched.value = true
  if (!isEmailValid.value) return

  error.value = null
  isLoading.value = true
  try {
    await forgotPasswordApi(email.value.trim())
    submitted.value = true
  } catch {
    error.value = 'Something went wrong. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login">
    <AuthBrandPanel tagline="The single source of truth for lab results validation and internal data auditing." />

    <div class="login-form-pane">
      <!-- Success state -->
      <div v-if="submitted" class="login-card">
        <div class="lc-head">
          <div class="fp-success-icon" aria-hidden="true">
            <VIcon name="mail-check" :size="32" />
          </div>
          <h1 class="lc-title">Check your inbox</h1>
          <p class="lc-sub">
            If an account with that email exists, a password reset link has been sent.
            Please check your inbox and spam folder.
          </p>
        </div>

        <RouterLink to="/login" class="link" style="text-align: center; display: block">
          Back to sign in
        </RouterLink>
      </div>

      <!-- Form state -->
      <form v-else class="login-card" novalidate @submit.prevent="submit">
        <div class="lc-head">
          <h1 class="lc-title">Forgot password?</h1>
          <p class="lc-sub">Enter your email and we'll send you a reset link.</p>
        </div>

        <div class="field">
          <label for="fp-email">Email address</label>
          <div
            :class="['input', { 'input--error': emailError }]"
            :aria-invalid="!!emailError"
          >
            <span class="lead" aria-hidden="true"><VIcon name="mail" :size="17" /></span>
            <input
              id="fp-email"
              v-model="email"
              type="email"
              placeholder="name@amalitech.com"
              autocomplete="email"
              :aria-describedby="emailError ? 'fp-email-error' : undefined"
              :aria-invalid="!!emailError"
              @blur="emailTouched = true"
            />
          </div>
          <span
            v-if="emailError"
            id="fp-email-error"
            class="field-error"
            role="alert"
          >
            <VIcon name="alert-circle" :size="13" />
            {{ emailError }}
          </span>
        </div>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <VButton
          type="submit"
          variant="primary"
          style="width: 100%"
          :disabled="isLoading"
          :aria-busy="isLoading"
        >
          {{ isLoading ? 'Sending…' : 'Send reset link' }}
        </VButton>

        <RouterLink to="/login" class="link" style="text-align: center; display: block">
          Back to sign in
        </RouterLink>
      </form>

      <div class="lc-secure" aria-hidden="true">
        <VIcon name="shield" :size="12" />
        SECURE 256-BIT ENCRYPTED SESSION
      </div>
    </div>
  </div>
</template>

<style scoped>
.fp-success-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
  color: var(--success);
}
</style>
