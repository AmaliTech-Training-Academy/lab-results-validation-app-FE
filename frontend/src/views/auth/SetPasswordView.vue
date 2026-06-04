<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AuthBrandPanel from '@/components/auth/AuthBrandPanel.vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'

const auth = useAuthStore()
const router = useRouter()

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirm = ref(false)

const score = computed(() => {
  const p = password.value
  if (!p) return 0
  if (p.length < 6) return 1
  if (p.length < 10) return 2
  if (/[0-9]/.test(p) && /[^a-zA-Z0-9]/.test(p)) return 4
  return 3
})

const SCORE_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']
const SCORE_COLORS = ['var(--danger)', 'var(--orange)', 'var(--orange)', 'var(--success)']

function submit() {
  auth.login({ name: 'David Kim', role: 'admin', initials: 'DK' })
  router.push('/admin/dashboard')
}
</script>

<template>
  <div class="login">
    <AuthBrandPanel>
      <div class="setpw-hero">
        <h2 class="setpw-hero-title">
          Secure your access to critical data infrastructure.
        </h2>
        <p class="setpw-hero-sub">
          You are setting up your administrator credentials for the first time. Please choose a
          strong password to ensure the integrity of our internal validation systems.
        </p>
      </div>
    </AuthBrandPanel>

    <div class="login-form-pane">
      <form class="login-card" @submit.prevent="submit">
        <div class="lc-head">
          <h1 class="lc-title">Set your password</h1>
          <p class="lc-sub">This is your first login. Choose a secure password to continue.</p>
        </div>

        <!-- New password -->
        <div class="field">
          <label>New password</label>
          <div class="input">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter your new password"
              autocomplete="new-password"
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
        </div>

        <!-- Strength meter -->
        <div>
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
          <div class="strength-bars">
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
          <label>Confirm password</label>
          <div class="input">
            <input
              v-model="confirmPassword"
              :type="showConfirm ? 'text' : 'password'"
              placeholder="Re-enter your password"
              autocomplete="new-password"
            />
            <button
              type="button"
              class="trail"
              :aria-label="showConfirm ? 'Hide password' : 'Show password'"
              @click="showConfirm = !showConfirm"
            >
              <VIcon :name="showConfirm ? 'eye-off' : 'eye'" :size="18" />
            </button>
          </div>
        </div>

        <VButton type="submit" variant="primary" style="width: 100%">
          Set password &amp; continue
        </VButton>

        <RouterLink to="/login" class="link" style="text-align: center; display: block">
          Back to sign in
        </RouterLink>
      </form>
    </div>
  </div>
</template>
