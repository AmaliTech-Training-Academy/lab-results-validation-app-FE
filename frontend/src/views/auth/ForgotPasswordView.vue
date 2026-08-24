<script setup lang="ts">
import { ref } from 'vue'
import { forgotPasswordApi } from '@/services/auth.service'
import { toErrorMessage } from '@/utils/errors'
import { useAllowedEmailDomain } from '@/composables/useAllowedEmailDomain'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import logoUrl from '@/assets/validata-logo.webp'
import mailboxUrl from '@/assets/mailbox.jpeg'

const email = ref('')
const emailTouched = ref(false)
const isLoading = ref(false)
const submitted = ref(false)
const error = ref<string | null>(null)

const { emailError, isEmailValid } = useAllowedEmailDomain(email, emailTouched)

async function submit() {
  emailTouched.value = true
  if (!isEmailValid.value) return

  error.value = null
  isLoading.value = true
  try {
    await forgotPasswordApi(email.value.trim())
    submitted.value = true
  } catch (err) {
    const msg = toErrorMessage(err, '')
    error.value = msg || 'Something went wrong. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <!-- Logo, top middle -->
      <img :src="logoUrl" alt="Validata" class="brand-logo" width="1172" height="220" />

      <!-- Success state -->
      <template v-if="submitted">
        <img :src="mailboxUrl" alt="" class="auth-illustration" aria-hidden="true" />
        <h1 class="auth-title">Check your inbox</h1>
        <p class="auth-sub">
          If an account with that email exists, a password reset link has been sent.
          Please check your inbox and spam folder.
        </p>
        <RouterLink to="/login" class="back-link">Back to sign in</RouterLink>
      </template>

      <!-- Form state -->
      <form v-else novalidate @submit.prevent="submit">
        <img :src="mailboxUrl" alt="" class="auth-illustration" aria-hidden="true" />

        <h1 class="auth-title">Reset password</h1>
        <p class="auth-sub">Enter your email and we'll send you a reset link.</p>

        <div class="field">
          <label for="fp-email">Email address</label>
          <div :class="['input', { 'input--error': emailError }]">
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
          <span v-if="emailError" id="fp-email-error" class="field-error" role="alert">
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
          {{ isLoading ? 'Sending…' : 'Send Email' }}
        </VButton>

        <RouterLink to="/login" class="back-link">Back to sign in</RouterLink>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  padding: 24px;
}

.auth-card {
  width: 100%;
  max-width: 560px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(8, 40, 59, 0.08);
  padding: 32px 40px 44px;
}

/* Logo — top middle */
.brand-logo {
  display: block;
  width: 124px;
  height: auto;
  margin: 0 auto 18px;
}

/* Mailbox line-art illustration, centered */
.auth-illustration {
  display: block;
  width: 132px;
  height: auto;
  margin: 0 auto 8px;
}

/* Keep the content column narrow and centered within the wide card */
.auth-card form,
.auth-card > .brand-logo ~ * {
  max-width: 380px;
  margin-left: auto;
  margin-right: auto;
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
  max-width: 320px;
}

/* Labels — darker + medium weight (matches sign-up) */
.field { margin-bottom: 22px; }
.field label {
  color: var(--text);
  font-weight: 600;
  font-size: 14px;
}

/* Filled, rounded inputs (matches sign-up) */
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
.input input:focus-visible {
  outline: none;
}

/* Dark-navy primary action button — identical to the sign-up page */
.auth-card :deep(.btn) {
  width: 100%;
  height: 52px;
  border-radius: 10px;
  font-size: 16px;
  background: var(--navy);
  color: #fff;
}
.auth-card :deep(.btn:hover) { background: var(--navy-2); }
.auth-card :deep(.btn:disabled) { background: var(--navy); opacity: 0.5; }

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
