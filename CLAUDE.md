# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Onward** — a preset-based AI visual generation app for professional creative teams. The product is intentionally *not* a free-prompting tool; users load backend-managed `.rdt` presets, fill structured inputs, optionally expand individual text fields with AI, and generate images through controlled prompt assembly and provider adapters. See `prd.md` for the full V1 spec and `BACKLOG.md` for current work.

## Commands

Package manager is **pnpm** (pnpm-lock.yaml present, `.npmrc` has `shamefully-hoist=true`). Node version pinned via `.nvmrc` to `v24.15.0`.

- `pnpm install` — install (runs `nuxt prepare` postinstall)
- `pnpm dev` — Nuxt dev server on `http://localhost:3000`
- `pnpm build` — production build
- `pnpm preview` — preview production build
- `pnpm generate` — static generate
- `pnpm lint` / `pnpm lint:fix` — ESLint (via `@nuxt/eslint`, config in `eslint.config.mjs`, extends `.nuxt/eslint.config.mjs`)

**Pre-commit hook** (`.husky/pre-commit`) runs `pnpm lint` — fix lint errors before committing rather than bypassing.

No test runner is installed yet — there is no `test` script and no Vitest in `package.json`. `AGENTS.md` describes a testing workflow that does not yet exist; do not invoke `pnpm test` or `pnpm vitest` until the runner is actually wired up.

## Architecture

This is a **Nuxt 4** app (`future.compatibilityVersion: 4` in `nuxt.config.ts`) using the `app/` source layout. Frontend lives in `app/`, Nitro server routes in `server/`, and shared preset definitions in `engines/`.

### Directory map

- `app/` — Nuxt frontend (Nuxt 4 convention; do **not** use `src/` despite what AGENTS.md suggests)
  - `app/api/` — client-side fetch wrappers (per AGENTS.md convention: each file exports individual functions)
  - `app/components/{ui,layout,features/*}/` — UI primitives, layout, and feature-scoped components
  - `app/layouts/` — `default.vue` (authed workspace shell), `auth.vue` (centered card), `public.vue` (marketing shell). Pages opt in via `definePageMeta({ layout: '...' })`.
  - `app/pages/` — file-based routes. Auth pages: `/login`, `/signup`, `/confirm` (Supabase callback), `/password/reset`. Public: `/`, `/blog`, `/contact`, `/privacy`. Protected: `/generate`.
  - `app/queries/`, `app/stores/`, `app/composables/`, `app/utils/`, `app/types/` — mostly `.gitkeep` placeholders today
- `server/` — Nitro server, intended source of truth for preset/project/AI logic
  - `server/api/` — HTTP endpoints (currently only `health.get.ts`; `presets/`, `projects/` are scaffolded)
  - `server/services/{ai,presets,projects,prompt,storage,usage}/` — adapter-style service layer (scaffolded)
  - `server/schemas/`, `server/types/`, `server/utils/` — server-side zod schemas / shared types
- `engines/` — local `.rdt` preset files (development fallback; in production they're served from the backend per PRD §18). See `engines/visual_scene_v1.rdt` for the canonical shape.

### Core domain concept: `.rdt` presets

A `.rdt` is a JSON document defining a generation workflow: `template` (with `{{TOKEN}}` placeholders), `fields[]` (UI inputs with optional per-field `expand.promptTemplate` for AI expansion), `constraints`, and `output`. The frontend **renders forms dynamically from `fields[]`** — there are no hand-written generation forms. Prompt assembly is:

```
FINAL_PROMPT = TEMPLATE_WITH_REPLACED_TOKENS + LOCKED_CONSTRAINT_SUFFIX
```

Both expansion and assembly happen server-side; the frontend never talks to AI providers directly. Provider calls go through an adapter abstraction (OpenAI for text expand, Gemini for image gen) so providers can be swapped without touching workflow logic.

### Auth model

Supabase Auth via `@nuxtjs/supabase` (configured in `nuxt.config.ts`):

- Login page: `/login`; callback: `/confirm`; `saveRedirectToCookie: true`
- **All routes are protected by default** — the `exclude` list (`/`, `/blog`, `/contact`, `/privacy`, `/signup`, `/password/reset`) is what stays public. **When adding a new public or auth-only route, add it to `supabase.redirectOptions.exclude`** or it will redirect to `/login`.
- Use `useSupabaseUser()` / `useSupabaseClient()` from the module rather than constructing clients.

### Storage / data (planned)

Per PRD: Supabase Postgres + Supabase Storage (`generated-assets` bucket, private by default, signed URLs). Object path convention: `user/{userId}/project/{projectId}/generation/{generationId}.{ext}`. Storage access goes through an adapter so S3 swap stays possible.

## Conventions

These are enforced or strongly preferred — see `AGENTS.md` for the full list (note: that file also describes aspirational tooling that doesn't yet exist).

- Vue: **Composition API + `<script setup>` only**, never Options API
- TypeScript: prefer `interface` over `type`; keep types beside the code that uses them
- Tailwind v4 (`@nuxt/ui` v4 ships its own color/semantic tokens): use utility classes; **do not hard-code colors** — use the theme tokens (`text-muted`, `bg-default`, etc., as seen in `app/layouts/default.vue`). Primary/neutral palette is set in `app/app.config.ts`.
- Functions: named `function` declarations for methods, arrow functions only for callbacks
- Exports: prefer named over default
- Comments: only when explaining *why*, not *what*

## Environment

See `.env.example`. Required vars: `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_KEY`, `NUXT_SUPABASE_SECRET_KEY`, plus `NUXT_OPENAI_API_KEY` (expand) and `NUXT_GEMINI_API_KEY` (generate) once those endpoints land.
