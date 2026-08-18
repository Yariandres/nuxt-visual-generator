# Engine v2 — Adopting the Client's `.rdt` Format

Status: **Planning** · Owner: TBD · Created: 2026-08-18

The client shipped three `.rdt` presets authored for a richer generation engine than
Onward V1 supports. This document specifies that format, maps the gap to the current
code, and breaks the upgrade into workstreams. No code has been written yet.

## 1. Why V1 can't load these files

The current schema (`shared/schemas/preset.ts`) expects
`id, name, version, template, fields[], constraints, output`.

The client files use a different, token-resolution engine:

```
id, label, version,
engineBlocks | coreFiles,   // named locked content blocks (values are strings)
dynamicFields[],            // user inputs (textarea + per-field AI expansion)
specialParams[],            // select / checkbox controls that inject prompt fragments
promptAssembly.template,    // the master template with {{TOKENS}}
tokenMap                    // {{TOKEN}} -> how to resolve it
```

All three fail V1 validation identically (`name`, `template`, `fields`, `constraints`,
`output` all missing). This is a format mismatch, not a data error — converting down to
V1 would discard real capability, so we are adopting the client format as canonical.

## 2. Format specification (derived from the three files)

### Top level
| Key | Notes |
|-----|-------|
| `id` | must stay a safe slug `^[A-Za-z0-9_]+$` and match the filename |
| `label` | display name (V1 `name`) |
| `version` | e.g. `2.0.0` |
| `engineBlocks` **or** `coreFiles` | object of `key -> string`; locked rule blocks |
| `dynamicFields[]` | user-facing inputs |
| `specialParams[]` | parameter controls |
| `promptAssembly.template` | string containing `{{TOKEN}}`s |
| `tokenMap` | `{{TOKEN}} -> resolver` |

### `dynamicFields[]`
Observed type: **`textarea`** only.
```
{ key, label, type:"textarea", placeholder, aiEnabled:boolean,
  aiExpansion: { model, instruction, includeFieldValue:boolean, contextFields:string[] } }
```
- `aiExpansion.model` — per-field model (seen: `gpt-4.1-mini`).
- `aiExpansion.instruction` — full system instruction (replaces V1's `{{value}}` template).
- `includeFieldValue` — whether the current field value is sent.
- `contextFields` — other field keys whose values are added as context.

### `specialParams[]`
Two types observed:
- **`select`** — `{ key, label, type:"select", default, options:[{ value, label, prompt }] }`
  Each option carries a **`prompt` fragment** injected when selected. (V1 select options are
  plain strings with no prompt — this is new.)
- **`checkbox`** — `{ key, label, type:"checkbox", default:boolean, checkboxLabel,
  true:{prompt}, false:{prompt} }` — selects a prompt branch by boolean.

### `tokenMap` resolvers
`{{TOKEN}} -> { source, key, fallback? }`. Observed `source` values:
| source | resolves to |
|--------|-------------|
| `core` | `coreFiles[key]` (locked block string) |
| `engine` | `engineBlocks[key]` (locked block string) |
| `field` | `dynamicFields` value for `key`, else `fallback` |
| `param` | selected `specialParams` option's `prompt` (or checkbox branch) |
| `computed` | engine-side computed logic; observed key: `colorBlock` |

`computed.colorBlock` depends on the `includeColorBlock` checkbox + the `colorPalette`
field — **exact rules for every computed key must be confirmed with the client** (see §6).

## 3. Gap vs current code

| Area | Current (V1) | Needs |
|------|--------------|-------|
| Schema | `shared/schemas/preset.ts` | new v2 schema + cross-validation (tokens ↔ tokenMap ↔ blocks/fields/params) |
| Prompt assembly | `server/services/prompt/assemble.ts` (direct token→field) | tokenMap resolver: core/engine/field/param/computed |
| Params | none | select-with-prompt-fragments + checkbox branches, selection state |
| Field types | `text`, `select` | `textarea` |
| Expand | `server/services/ai/expand.ts`, `ai/openai.ts` (single model, `{{value}}`) | per-field `model`, `instruction`, `includeFieldValue`, `contextFields` |
| Expand guard | `field.type==='text' && expand.enabled` | `type==='textarea' && aiEnabled` |
| Generate | `server/api/generate.post.ts` | pass fields **and** params to assembler |
| Request schemas | `server/schemas/*` | include `params` alongside `fields` |
| Dynamic form | `app/components/features/presets/FieldsForm.vue` | render textarea + params panel (select/checkbox) |
| Loader | `server/services/presets/loader.ts` | format-agnostic already; keep slug guard |
| Storage | bundled server asset (BL-039 pending) | folds into this work |

## 4. Compatibility decision

Introduce a **`schemaVersion`/format discriminator** and validate v2 with a separate zod
schema. The lone V1 preset (`visual_scene_v1.rdt`) is a dev fixture — port it to v2 or
retire it once v2 lands, rather than maintaining two engines long-term. The loader,
being JSON-shape-agnostic, stays; only validation + assembly branch on format.

## 5. Workstreams (proposed backlog — see BACKLOG.md Milestone 10)

- **BL-040** v2 preset schema + validation
- **BL-041** tokenMap prompt-assembly engine (core/engine/field/param/computed)
- **BL-042** specialParams model + UI (select-with-prompt, checkbox)
- **BL-043** textarea dynamic fields + per-field AI expansion (model/context)
- **BL-044** generate/expand API + request-schema updates for params
- **BL-045** port/retire `visual_scene_v1`; load the three client presets
- **BL-046** tests: schema, tokenMap resolution, computed blocks, param fragments, expansion context
- **BL-039** (existing) DB-backed presets — sequence after v2 so uploads don't need a redeploy

## 6. Open questions for the client (blocking full spec)

1. **Computed keys** — full list and exact logic for each (only `colorBlock` seen). What
   inputs drive it and what does it emit?
2. **Param types** — is the set limited to `select` + `checkbox`, or are there others
   (range, multi-select, text param)?
3. **AI models** — which models are allowed for `aiExpansion.model`, and how do they map
   to our provider config/keys? (`gpt-4.1-mini` is referenced.)
4. **`engineBlocks` vs `coreFiles`** — same concept under two names, or a real distinction?
5. **`foto-lifestyle-from-set.rdt`** — filename has hyphens and its internal `id` is
   `lifestyle_from_set_engine`. Confirm the canonical id/filename so they agree.
6. **Ratio/output** — `specialParams.ratio` carries composition prompts; is the aspect
   ratio also passed to the image provider as an output setting, or prompt-only?

## 7. Notes

- The three files currently sit **untracked in the repo root**; they are inputs to this
  plan, not committed presets. They move into `engines/` (or the DB per BL-039) once the
  v2 loader accepts them.
