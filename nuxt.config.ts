// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  future: {
    compatibilityVersion: 4,
  },

  css: ['~/assets/css/main.css'],

  // Defaults are read at build time; the real values come from `NUXT_*` env vars
  // at runtime. Server-only by design — no `public` block for AI keys.
  runtimeConfig: {
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@pinia/nuxt',
    '@nuxtjs/supabase',
  ],

  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/', '/blog', '/contact', '/privacy', '/signup', '/password/reset'],
      saveRedirectToCookie: true,
    },
  },
})