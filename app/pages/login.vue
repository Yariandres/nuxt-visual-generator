<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const loading = ref(false)
const errorMessage = ref('')

watch(user, () => {
  if (user.value) {
    navigateTo('/generate')
  }
}, { immediate: true })

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'you@example.com',
    required: true,
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
    required: true,
  },
]

const schema = z.object({
  email: z.email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type Schema = z.output<typeof schema>

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  errorMessage.value = ''

  const { error } = await supabase.auth.signInWithPassword({
    email: event.data.email,
    password: event.data.password,
  })

  if (error) {
    errorMessage.value = error.message
  }

  loading.value = false
}
</script>

<template>
  <UPageCard>
    <UAuthForm
      :schema="schema"
      :fields="fields"
      title="Welcome back"
      description="Sign in to your Onward account."
      :submit="{ label: 'Sign in', loading, block: true }"
      @submit="onSubmit"
    >
      <template #password-hint>
        <NuxtLink to="/forgot-password" class="text-sm font-medium text-primary">
          Forgot password?
        </NuxtLink>
      </template>

      <template v-if="errorMessage" #validation>
        <UAlert
          color="error"
          icon="i-lucide-circle-alert"
          :title="errorMessage"
        />
      </template>

      <template #footer>
        <span class="text-sm text-muted">
          Don't have an account?
          <NuxtLink to="/signup" class="font-medium text-primary">Sign up</NuxtLink>
        </span>
      </template>
    </UAuthForm>
  </UPageCard>
</template>
