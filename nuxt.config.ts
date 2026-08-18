import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  future: {
    compatibilityVersion: 4,
  },

  // Bundle the local `.rdt` presets into the server output as a Nitro server
  // asset. A runtime `fs` read of `engines/` works in dev but not in the
  // Netlify serverless bundle (untraced files are dropped), which is why prod
  // showed "No presets yet". The loader reads these via `useStorage`.
  // TODO(BL-039): remove once presets are served from the DB in production.
  nitro: {
    serverAssets: [
      {
        baseName: 'engines',
        dir: fileURLToPath(new URL('./engines', import.meta.url)),
      },
    ],
  },

  css: ['~/assets/css/main.css'],

  // Defaults are read at build time; the real values come from `NUXT_*` env vars
  // at runtime. Server-only by design — no `public` block for AI keys.
  runtimeConfig: {
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash-image',
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