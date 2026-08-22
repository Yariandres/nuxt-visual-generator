# Onward — Session Handoff

Read this first if you're a new agent/session picking up this project. It explains **what
we're building, why, and exactly where in the codebase to work**. It points to the durable
source-of-truth docs rather than duplicating them.

Last updated: 2026-08-22.

---

## 0. How to use this doc

1. Skim §1–§3 for context and current status.
2. Use §4 (architecture map) to find the right files for a task.
3. Before touching the engine, read §5 **and** `docs/engine-v2-plan.md` (the full format spec).
4. §7 (decisions) and §8 (gotchas) will save you from re-learning things the hard way.
5. §9 is how to run/test/deploy.

Durable source-of-truth files, all in-repo:
- `docs/engine-v2-plan.md` — the client `.rdt` format spec, gap analysis, and the resolved
  client answers (with meeting timestamps).
- `BACKLOG.md` — all work items. **Milestone 10** = engine v2; **Milestone 11** = UI/feature
  intake from the client call. Earlier milestones (1–9) are mostly `Done`.
- `prisma/schema.prisma` — the data model.

---

## 1. What Onward is

A preset-based AI visual-generation web app. A user signs in, picks a **preset**, fills a
dynamic form generated from that preset, optionally **expands** individual text fields with
AI, then **generates** an image. Generated images are stored privately and shown via signed
URLs. Usage is tracked per action for future billing.

Stack: **Nuxt 4** (compat v4) + **Nuxt UI**, **Nitro** server routes, **Supabase**
(auth + Postgres + Storage), **Prisma**, **OpenAI** (text expand) + **Gemini** (image gen).
Deployed on **Netlify** (auto-deploys on push to `main`, ~1 min).

A "preset" is a `.rdt` file (JSON) describing the fields, template, and constraints for one
kind of generation. Today's V1 sample is `engines/visual_scene_v1.rdt`.

---

## 2. What we're doing right now & why

The client uses a **richer preset engine** than Onward's V1 supports, and sent three `.rdt`
files authored for it. Two active workstreams came out of the 2026-08-22 client call:

**A. Engine v2 — adopt the client's `.rdt` format** (BACKLOG Milestone 10, `BL-040`–`BL-046`).
V1 describes a generation as one `template` string + flat `fields[]`. The client's format is a
**token-resolution engine**: a master template whose every `{{TOKEN}}` is filled from a named
source (`tokenMap`) — a locked rule block, a user field, a parameter's prompt fragment, or
computed logic. V1's schema can't represent this, and converting the files *down* to V1 would
throw away real capability. Decision: **upgrade the engine to the client's format.** The full
spec + all resolved client answers are in `docs/engine-v2-plan.md`. **Spec is complete — ready
to build; start at BL-040.**

**B. UI/feature changes from the call** (BACKLOG Milestone 11, `BL-047`–`BL-055`). Independent
of the engine work, mostly UI. Examples: remove blog/contact pages, cap image upload at 3,
hide the final prompt from users, image edit buttons, user-selectable image model + upscale,
usage→credits display. These are **intake items — refine scope before building.**

Also already shipped (context): presets were failing to load in production because the loader
read `.rdt` files off the filesystem at runtime, which Netlify's serverless bundler drops.
Fixed by bundling `engines/` as a Nitro server asset and decoding the bundled bytes. See §8.

---

## 3. Current status

| Area | Status |
|------|--------|
| V1 app (auth, presets, dynamic form, expand, generate, projects, usage, storage) | **Done** (Milestones 1–9, mostly) |
| Production preset-loading fix (server asset + bytes decode) | **Done & deployed** |
| Engine v2 spec + client answers | **Complete** (`docs/engine-v2-plan.md`) |
| Engine v2 implementation (BL-040–046) | **Not started** — next up |
| UI/feature intake (BL-047–055) | **Not started** — being scoped |

**The three client `.rdt` files are currently UNTRACKED in the repo root**
(`package_visualization_engine.rdt`, `visualisation_design_end.rdt`,
`foto-lifestyle-from-set.rdt`). They are inputs, not yet valid presets. They move into
`engines/` (or the DB) once the v2 loader accepts them (BL-045).

---

## 4. Architecture map (the request flow)

Frontend lives in `app/`, backend in `server/`, shared validation in `shared/`.

**Preset workspace UI**
- `app/pages/generate.vue` — the main workspace page.
- `app/composables/useWorkflowState.ts` — current preset, input values, expand/generate status.
- `app/components/features/presets/Selector.vue` — preset picker.
- `app/components/features/presets/FieldsForm.vue` — renders the dynamic form from a preset
  (today: `text`/`select`; v2 adds `textarea` + a params panel).
- `app/api/*.ts` (`presets.ts`, `expand.ts`, `generate.ts`, `projects.ts`, `usage.ts`) —
  thin client-side `$fetch` wrappers around the server routes (typed).

**Preset loading & validation**
- `shared/schemas/preset.ts` — the Zod preset schema + `validatePreset()`. **This is where the
  V1 vs v2 format branch goes.**
- `server/services/presets/loader.ts` — reads `engines/*.rdt` via Nitro storage
  (`useStorage('assets:engines')`), validates, returns summaries/detail. Format-agnostic on
  read; validation is in the schema. Has a test-only storage injector (see §8).
- `server/services/presets/persist.ts` — `ensurePresetRecord()` upserts a preset into the DB
  (`Preset` model) keyed by `(slug, version)` so generations/projects can FK to it.
- `server/api/presets/index.get.ts`, `server/api/presets/[id].get.ts` — list/detail routes.
- `server/utils/validation.ts` — request-payload validation (preset id slug, field keys,
  input sanitization, `MAX_INPUT_VALUE_LENGTH`). Preset id rule: `^[A-Za-z0-9_]+$`.

**Prompt assembly** (V1 today; v2 rewrite target)
- `server/services/prompt/assemble.ts` — `FINAL_PROMPT = template-with-tokens-replaced +
  constraint suffix`. **v2 replaces this with a `tokenMap` resolver** (core/engine/field/param/
  computed). See BL-041.

**Text expansion (OpenAI)**
- `server/api/expand.post.ts` → `server/services/ai/expand.ts` → `server/services/ai/openai.ts`.
- Adapter interfaces in `server/services/ai/types.ts`; error mapping in `errors.ts`.
- v2: per-field `model` + `instruction` + `contextFields` (BL-043).

**Image generation (Gemini)**
- `server/api/generate.post.ts` → `server/services/generation/run.ts` (orchestration) →
  `server/services/prompt/assemble.ts` (prompt) → `server/services/ai/gemini.ts` (image) →
  `server/services/storage/supabase.ts` (store) → `server/services/usage/record.ts` (track).
- v2: request carries `params`; the `ratio` param must be passed to the provider as the real
  output aspect ratio (BL-044).

**Projects & history**
- `server/api/projects/*` (create/get/update, `[id]/generations.get.ts`).
- `server/services/projects/service.ts`, `server/services/generations/history.ts`.

**Storage**
- `server/services/storage/{supabase,path,types,errors}.ts` — Supabase Storage adapter,
  object-path convention, signed URLs. Bucket is private.

**Usage**
- `server/services/usage/{record,summary,pricing}.ts`, `server/api/usage/summary.get.ts`,
  `app/pages/usage.vue`. Basis for BL-055 (usage→credits).

**Data model** — `prisma/schema.prisma`: `Profile`, `Preset`, `Project`, `Generation`,
`UsageEvent`. RLS + storage policies already set up (Milestone 2).

**Config** — `nuxt.config.ts`: `nitro.serverAssets` bundles `engines/`; `runtimeConfig` holds
server-only AI keys (`NUXT_OPENAI_API_KEY`, `NUXT_GEMINI_API_KEY`, models); `@nuxtjs/supabase`
module + route protection. `app/pages/{blog,contact}.vue` are the pages BL-047 removes.

**Tests** — `tests/*.test.ts`, plain-node **Vitest** (no Nitro runtime). Aliases in
`vitest.config.ts` (`#shared`, `~~`, `~`). Shared fixtures in `tests/fixtures.ts`.

---

## 5. Engine v2 — what changes and where

Read `docs/engine-v2-plan.md` for the complete format spec. In short, the client format is:

```
id, label, version,
engineBlocks (locked rule-block strings; coreFiles is an accepted alias),
dynamicFields[]  (textarea + aiExpansion{model,instruction,includeFieldValue,contextFields}),
specialParams[]  (select w/ per-option prompt; checkbox w/ true/false prompt),
promptAssembly.template  (the master template with {{TOKENS}}),
tokenMap         ({{TOKEN}} -> {source: core|engine|field|param|computed, key, fallback?})
```

Build steps (BACKLOG Milestone 10), each mapped to files:
- **BL-040** v2 schema + validation → `shared/schemas/preset.ts` (add format discriminator;
  normalize `coreFiles`→`engineBlocks`; whitelist computed keys; cross-validate tokens).
- **BL-041** tokenMap assembly engine → `server/services/prompt/assemble.ts`.
- **BL-042** params model + UI (select/checkbox) → new + `app/components/features/presets/FieldsForm.vue`.
- **BL-043** textarea + per-field AI expand → `server/services/ai/{expand,openai}.ts`, form.
- **BL-044** generate/expand carry params; ratio→output → `server/api/{generate,expand}.post.ts`,
  `server/utils/validation.ts`, `server/services/generation/run.ts`.
- **BL-045** load the 3 client presets (rename foto file) → `engines/`.
- **BL-046** tests → `tests/`.

Keep V1 working alongside v2 via the format discriminator; `visual_scene_v1.rdt` is a dev
fixture that can be ported or retired.

---

## 6. Confirmed client decisions (don't re-ask)

From the 2026-08-22 meeting + email (details + timestamps in `docs/engine-v2-plan.md §6`):

- **Computed keys**: `colorBlock` is the **only** one. Logic: if the `includeColorBlock`
  checkbox is on, insert the color-palette section from the `colorPalette` field; else omit.
  Keep computed keys **whitelisted** (unknown computed key = validation error).
- **Param types**: `select` + `checkbox` **only** for v2; build extensibly for future
  slider/multi-select but don't implement them.
- **Aspect ratio**: the `ratio` param **both** injects its composition prompt **and** sets the
  image's real output aspect ratio sent to the provider.
- **engineBlocks vs coreFiles**: same concept — `engineBlocks` is canonical; accept `coreFiles`
  as an alias and normalize on load.
- **AI models**: `gpt-4.1-mini` for text expand; the **image model is user-selectable** (Gemini
  family) + an upscale option (BL-054).
- **foto file**: rename `foto-lifestyle-from-set.rdt` → `lifestyle_from_set_engine.rdt` to match
  its canonical underscore `id` (naming-only).
- **Presets in the DB**: the client wants to add/remove presets without a redeploy → BL-039.

---

## 7. Conventions

- Preset **id/slug**: `^[A-Za-z0-9_]+$`, and the internal `id` must equal the filename stem.
- Field **keys**: `^[A-Z][A-Z0-9_]*$`. Template tokens are `{{KEY}}`.
- Server-only secrets live in `runtimeConfig` (no `public` block for AI keys). Supabase public
  values are client-side; the service-role key is server-only.
- Match surrounding code style. Server logic lives under `server/services`, not in components.
- Git: work commits to `main` and Netlify auto-deploys on push. Commit messages end with a
  `Co-Authored-By: Claude ...` trailer. Push only what should deploy.

---

## 8. Gotchas & lessons already learned

- **Preset loader dev/prod skew (already fixed — don't regress).** `engines/*.rdt` are bundled
  as a Nitro **server asset** (`nitro.serverAssets` in `nuxt.config.ts`, mount `assets:engines`),
  not read from `process.cwd()`. In the Netlify build, `useStorage(...).getItem()` returns a
  **`Uint8Array`** (bytes), while the dev fs driver returns a string — `loader.ts` decodes both
  before `JSON.parse`. A regression test reproducing the bytes driver lives in
  `tests/loader-guard.test.ts`. If you change the loader, keep the byte-decoding path.
- **Tests are plain-node Vitest with no Nitro runtime.** `useStorage` doesn't exist there, so
  `loader.ts` exposes `_setEnginesStorageForTests()` and the test injects an `unstorage` storage.
  Anything relying on Nitro auto-imports won't run under Vitest as-is.
- **Netlify auto-deploys `main`.** A push triggers a ~1 min build+publish. Verify prod after.
- **The 3 client `.rdt` files are untracked in the repo root** and are a **different format** —
  they will NOT pass V1 validation; that's expected until BL-040/045.
- The meeting **transcript** (`~/Desktop/client-meeting-transcript.srt`) is outside the repo and
  won't exist on another machine — the answers you need are captured in `docs/engine-v2-plan.md`.

---

## 9. Run / test / verify / deploy

```bash
pnpm dev      # dev server on :3000
pnpm test     # vitest run (plain-node)
pnpm lint     # eslint
pnpm build    # production build (Nitro)
```

- Env vars needed at runtime: `NUXT_OPENAI_API_KEY`, `NUXT_GEMINI_API_KEY` (+ model overrides),
  and Supabase public + service-role config. See `nuxt.config.ts` `runtimeConfig`.
- Deploy = push to `main` (Netlify). No manual deploy step.

---

## 10. Related docs & links

- `docs/engine-v2-plan.md` — engine v2 format spec + resolved client answers (authoritative).
- `BACKLOG.md` — Milestones 10 (engine v2) and 11 (UI/feature intake), plus 1–9 history.
- `prisma/schema.prisma` — data model.
- Client-facing brief (private artifact): https://claude.ai/code/artifact/95e4e041-d116-407f-bc35-df72a2041007
