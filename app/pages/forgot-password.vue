<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
})

const supabase = useSupabaseClient()
const loading = ref(false)
const errorMessage = ref('')
const success = ref(false)

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'you@example.com',
    required: true,
  },
]

const schema = z.object({
  email: z.email('Please enter a valid email'),
})

type Schema = z.output<typeof schema>

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  errorMessage.value = ''

  const { error } = await supabase.auth.resetPasswordForEmail(event.data.email, {
    redirectTo: `${window.location.origin}/confirm`,
  })

  if (error) {
    errorMessage.value = error.message
  }
  else {
    success.value = true
  }

  loading.value = false
}
</script>

<template>
  <UPageCard>
    <template v-if="success">
      <div class="flex flex-col items-center gap-3 py-8 text-center">
        <UIcon name="i-lucide-mail-check" class="size-10 text-primary" />
        <h2 class="text-lg font-semibold text-highlighted">Check your email</h2>
        <p class="max-w-xs text-sm text-muted">
          If an account exists with that email, we sent a password reset link.
        </p>
        <UButton label="Back to sign in" to="/login" color="neutral" variant="outline" class="mt-2" />
      </div>
    </template>

    <UAuthForm
      v-else
      :schema="schema"
      :fields="fields"
      title="Reset your password"
      description="Enter your email and we'll send you a reset link."
      :submit="{ label: 'Send reset link', loading, block: true }"
      @submit="onSubmit"
    >
      <template v-if="errorMessage" #validation>
        <UAlert
          color="error"
          icon="i-lucide-circle-alert"
          :title="errorMessage"
        />
      </template>

      <template #footer>
        <span class="text-sm text-muted">
          Remember your password?
          <NuxtLink to="/login" class="font-medium text-primary">Sign in</NuxtLink>
        </span>
      </template>
    </UAuthForm>
  </UPageCard>
</template>
