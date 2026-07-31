import { computed, type Ref } from 'vue'

const ALLOWED_DOMAINS = new Set(['amalitech.com', 'amalitechtraining.com', 'amalitechtraining.org'])

/** Validates that `email` belongs to one of the AmaliTech domains, shared by every auth form. */
export function useAllowedEmailDomain(email: Ref<string>, touched: Ref<boolean>) {
  const isEmailValid = computed(() => {
    const domain = email.value.split('@')[1]?.toLowerCase()
    return !!domain && ALLOWED_DOMAINS.has(domain)
  })

  const emailError = computed(() => {
    if (!touched.value || !email.value) return ''
    return isEmailValid.value
      ? ''
      : 'Email must be from @amalitech.com, @amalitechtraining.com, or @amalitechtraining.org'
  })

  return { emailError, isEmailValid }
}
