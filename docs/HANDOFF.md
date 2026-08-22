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
spec + all resolved client answers are in `docs/engine-v2-plan.md`. **DONE (2026-08-22):
BL-040–046 all shipped — the v2 engine + workspace works end-to-end (see §5).**

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
| Engine v2 implementation (BL-040–046) | **Done** (2026-08-22) — v2 workspace end-to-end |
| UI/feature intake (BL-047–055) | **Not started** — being scoped (BL-045 done as part of v2) |

**Engine v2 is now implemented and working in `/generate`** (see §5). The three client
presets live in `engines/` and load as v2; the loader validates via `validateAnyPreset`, so
v1 and v2 coexist. `engines/` now holds: `package_visualization_engine.rdt`,
`visualisation_design_end.rdt`, `lifestyle_from_set_engine.rdt` (renamed from the
`foto-*` file per BL-045), and the V1 `visual_scene_v1.rdt`. Not yet committed to `main` at
time of writing — the full v2 changeset is staged locally. Live image/text calls still need
`GEMINI`/`OPENAI` keys; only rendering + request plumbing were verified in-browser.

---

## 4. Architecture map (the request flow)

Frontend lives in `app/`, backend in `server/`, shared validation in `shared/`.

**Preset workspace UI**
- `app/pages/generate.vue` — the main workspace page.
- `app/composables/useWorkflowState.ts` — current preset, input values, expand/generate status.
- `app/components/features/presets/Selector.vue` — preset picker.
- `app/components/features/presets/FieldsForm.vue` — renders the V1 dynamic form
  (`text`/`select`). v2 uses `DynamicFields.vue` (`textarea` + per-field expand) and
  `SpecialParams.vue` (the params panel); `generate.vue` switches by format.
- `app/api/*.ts` (`presets.ts`, `expand.ts`, `generate.ts`, `projects.ts`, `usage.ts`) —
  thin client-side `$fetch` wrappers around the server routes (typed).

**Preset loading & validation**
- `shared/schemas/preset.ts` — Zod schemas for both formats. `validatePreset()` (V1),
  `validatePresetV2()`, and `validateAnyPreset()` (the format-discriminating entry). `AnyPreset`
  = `Preset | PresetV2`; branch with `'fields' in preset` (V1) vs else (v2).
- `server/services/presets/loader.ts` — reads `engines/*.rdt` via Nitro storage
  (`useStorage('assets:engines')`), validates via `validateAnyPreset`, returns summaries/detail
  as `AnyPreset`. Format-agnostic on read. Has a test-only storage injector (see §8).
- `server/services/presets/persist.ts` — `ensurePresetRecord()` upserts a preset into the DB
  (`Preset` model) keyed by `(slug, version)` so generations/projects can FK to it.
- `server/api/presets/index.get.ts`, `server/api/presets/[id].get.ts` — list/detail routes.
- `server/utils/validation.ts` — request-payload validation (preset id slug, field keys,
  input sanitization, `MAX_INPUT_VALUE_LENGTH`). Preset id rule: `^[A-Za-z0-9_]+$`.

**Prompt assembly** (both formats live)
- `server/services/prompt/assemble.ts` — V1 `assemblePrompt` (`FINAL_PROMPT =
  template-with-tokens-replaced + constraint suffix`) and v2 `assemblePromptV2` (the `tokenMap`
  resolver: core/engine/field/param/computed). `runGeneration` picks by format via
  `assembleForPreset`.

**Text expansion (OpenAI)**
- `server/api/expand.post.ts` → `server/services/ai/expand.ts` → `server/services/ai/openai.ts`.
- Adapter interfaces in `server/services/ai/types.ts`; error mapping in `errors.ts`.
- `expandField` branches V1/v2; v2 uses the field's per-field `model` + `instruction`,
  `includeFieldValue`, and `contextFields` context (the expand route forwards the full
  `inputs` map). The OpenAI adapter runs a v2 mode alongside the V1 `{{value}}` path.

**Image generation (Gemini)**
- `server/api/generate.post.ts` → `server/services/generation/run.ts` (orchestration) →
  `server/services/prompt/assemble.ts` (prompt) → `server/services/ai/gemini.ts` (image) →
  `server/services/storage/supabase.ts` (store) → `server/services/usage/record.ts` (track).
- `runGeneration` takes `AnyPreset` + `params`; for v2 the selected `ratio` param sets the real
  output aspect ratio passed to the provider (`resolveV2AspectRatio`), not prompt-only.

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

Build steps (BACKLOG Milestone 10) — **all DONE (2026-08-22)**, mapped to what shipped:
- **BL-040** ✅ v2 schema + validation → `shared/schemas/preset.ts`: `validatePresetV2`,
  `detectPresetFormat`, `validateAnyPreset`, `PresetV2` types. Format discriminator, computed
  whitelist (`colorBlock`), `coreFiles`→`engineBlocks` normalization, token cross-validation.
- **BL-041** ✅ tokenMap assembly → `assemblePromptV2` in `server/services/prompt/assemble.ts`
  (core/engine/field/param/computed, blank-line collapse). V1 `assemblePrompt` untouched.
- **BL-042** ✅ params model + UI → `app/components/features/presets/SpecialParams.vue`
  (select/checkbox), param state in `useWorkflowState` (`params`/`setParam`/`seedParams`).
- **BL-043** ✅ textarea + per-field AI expand → `DynamicFields.vue`; `expandField` +
  `ai/openai.ts` branch V1/v2 (per-field model/instruction, `includeFieldValue`,
  `contextFields` context via the `/api/expand` `inputs` map).
- **BL-044** ✅ generate/expand carry params; ratio→output → `paramsSchema` in
  `server/utils/validation.ts` (`fieldKeySchema` broadened to camelCase), `runGeneration`
  takes `AnyPreset`+`params` and branches assembly; v2 `ratio` sets the real output aspect
  ratio (`resolveV2AspectRatio`). loader/persist/projects service take `AnyPreset`.
- **BL-045** ✅ 3 client presets in `engines/` (foto renamed to `lifestyle_from_set_engine.rdt`);
  loader validates via `validateAnyPreset`.
- **BL-046** ✅ tests → `tests/{preset-v2,assemble-v2,expand-v2}.test.ts` (97 passing total).

V1 works alongside v2 via the format discriminator; `visual_scene_v1.rdt` is kept as a V1 dev
fixture. **Detect format structurally, never by version** — `lifestyle_from_set_engine` is
v2-shaped but `version: 1.0.0`. On an `AnyPreset`, `'fields' in preset` ⇒ V1, else v2.
The `/generate` layout was reorganized: left = Presets + Parameters panel; right = the dynamic
fields editor (v2 `DynamicFields` / v1 `FieldsForm`), replacing the old mock Editor/Parameters.

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
- **The 3 client `.rdt` files now live in `engines/`** (moved from the repo root as part of
  BL-045; `foto-*` renamed to `lifestyle_from_set_engine.rdt`). They are the v2 format and load
  via `validateAnyPreset` — no longer a "won't pass validation" gotcha.
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
