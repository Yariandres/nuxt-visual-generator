# Frontend Nuxt Structure Reference

This document defines the frontend folder structure for Onward. Use it as the implementation reference for Nuxt pages, Vue components, composables, Pinia stores, Pinia Colada queries, API client functions, and UI conventions.

## Frontend Principles

- Keep pages thin. Pages compose feature components, route-level metadata, and route-level data requirements.
- Keep reusable UI components generic. Put workflow-specific behavior in feature components.
- Keep server data in API client functions and Pinia Colada queries. Do not fetch directly from components with raw route strings.
- Keep Pinia stores for client workflow state, UI state, and cross-route state that is not a server cache.
- Keep types close to the feature that owns them. Export shared interfaces from domain type files when multiple modules need them.
- Use Composition API with `<script setup lang="ts">`.
- Use Tailwind CSS and Nuxt UI semantic tokens. Do not add manual CSS or hard-code raw colors.
- Use named functions for methods. Use arrow functions only for callbacks.

## Directory Structure

Nuxt 4 uses the `app/` directory for frontend code. Keep frontend modules under `app/` and server routes under `server/`.

```txt
app/
├── app.vue
├── app.config.ts
├── assets/
│   └── css/
│       └── main.css
├── pages/
│   ├── index.vue
│   ├── login.vue
│   ├── projects/
│   │   ├── index.vue
│   │   └── [projectId].vue
│   └── generate.vue
├── layouts/
│   ├── default.vue
│   └── auth.vue
├── components/
│   ├── ui/
│   ├── layout/
│   └── features/
│       ├── auth/
│       ├── generator/
│       ├── presets/
│       ├── projects/
│       └── generations/
├── composables/
│   ├── useRequiredFields.ts
│   ├── usePromptPreview.ts
│   └── useWorkflowForm.ts
├── api/
│   ├── presets.ts
│   ├── expand.ts
│   ├── generate.ts
│   └── projects.ts
├── queries/
│   ├── presets.ts
│   ├── projects.ts
│   └── generations.ts
├── stores/
│   ├── workflow.ts
│   └── ui.ts
├── middleware/
│   └── auth.ts
├── plugins/
│   └── supabase.client.ts
├── utils/
│   ├── formatDate.ts
│   ├── formatError.ts
│   └── object.ts
└── types/
    ├── api.ts
    ├── presets.ts
    ├── projects.ts
    ├── generations.ts
    └── workflow.ts
```

Tests live beside the file they cover.

```txt
app/
├── components/
│   └── features/
│       └── generator/
│           ├── GeneratorForm.vue
│           └── GeneratorForm.spec.ts
└── utils/
    ├── formatError.ts
    └── formatError.spec.ts
```

## Root App

Use `app/app.vue` as the root shell. Nuxt UI requires `UApp` at the root for overlays, toasts, tooltips, and programmatic UI.

```vue
<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

Keep root logic minimal. Put global providers in plugins and route-specific UI in layouts or pages.

## App Config

Use `app/app.config.ts` for Nuxt UI theme configuration and app-level UI tokens.

```ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'neutral',
      neutral: 'zinc',
    },
  },
})
```

Use semantic classes such as `text-default`, `text-muted`, `bg-default`, `bg-elevated`, and `border-muted`. Avoid raw palette classes like `text-gray-500` unless the design system explicitly adds them.

## Assets

Keep processed frontend assets in `app/assets`.

```txt
app/assets/
├── css/
│   └── main.css
├── images/
└── icons/
```

`app/assets/css/main.css` should stay focused on framework imports and rare global layers.

```css
@import "tailwindcss";
@import "@nuxt/ui";
```

Do not place generated images or user uploads in assets. Generated outputs belong in Supabase Storage and are rendered from signed URLs.

## Pages

Pages define URL-level composition. They should avoid business logic and provider-specific calls.

```txt
app/pages/
├── index.vue
├── login.vue
├── generate.vue
└── projects/
    ├── index.vue
    └── [projectId].vue
```

Suggested V1 routes:

| Route | File | Purpose |
|---|---|---|
| `/` | `app/pages/index.vue` | Landing or redirect to generator |
| `/login` | `app/pages/login.vue` | Authentication entry |
| `/generate` | `app/pages/generate.vue` | Main preset workflow |
| `/projects` | `app/pages/projects/index.vue` | Saved project list |
| `/projects/:projectId` | `app/pages/projects/[projectId].vue` | Load and continue a project |

Page responsibilities:

- Set route metadata with `definePageMeta()`.
- Compose feature components.
- Read route params.
- Call query wrappers for route-level data.
- Render page-level loading, empty, and error states.

Example page shape:

```vue
<script setup lang="ts">
definePageMeta({
  middleware: ['auth'],
})
</script>

<template>
  <GeneratorWorkspace />
</template>
```

## Layouts

Use layouts for repeated page chrome, not feature behavior.

```txt
app/layouts/
├── default.vue
└── auth.vue
```

`default.vue`: authenticated product shell with header, navigation, and main content region.

`auth.vue`: focused authentication shell for login and account routes.

Layout responsibilities:

- Render persistent navigation.
- Provide consistent page width and spacing.
- Place route content through `<slot />`.
- Avoid data fetching unless the layout truly owns the data.

## Components

Use three component layers: `ui`, `layout`, and `features`.

```txt
app/components/
├── ui/
├── layout/
└── features/
```

### `components/ui`

Use for reusable project-level primitives that wrap or compose Nuxt UI.

```txt
app/components/ui/
├── EmptyState.vue
├── ErrorState.vue
├── LoadingState.vue
└── SectionCard.vue
```

Rules:

- Keep props generic.
- Do not import feature queries or stores.
- Prefer Nuxt UI components before creating custom primitives.
- Use Tailwind utility classes and semantic color tokens.

### `components/layout`

Use for app shell components.

```txt
app/components/layout/
├── AppHeader.vue
├── AppSidebar.vue
├── AppNavigation.vue
└── AppPageHeader.vue
```

Rules:

- Keep navigation and shell concerns here.
- Avoid feature-specific API calls.
- Accept navigation items and user display data through props when practical.

### `components/features`

Use for domain-specific UI and workflow behavior.

```txt
app/components/features/
├── auth/
│   └── LoginForm.vue
├── generator/
│   ├── GeneratorWorkspace.vue
│   ├── GeneratorForm.vue
│   ├── DynamicPresetField.vue
│   ├── PromptPreview.vue
│   └── OutputPreview.vue
├── presets/
│   ├── PresetSelector.vue
│   └── PresetSummaryCard.vue
├── projects/
│   ├── ProjectSaveButton.vue
│   ├── ProjectList.vue
│   └── ProjectCard.vue
└── generations/
    ├── RecentOutputs.vue
    └── GenerationThumbnail.vue
```

Rules:

- Keep feature components grouped by domain.
- Split large workflow components when state or templates become difficult to scan.
- Allow feature components to use query wrappers, mutations, stores, and composables.
- Do not call provider SDKs or Nuxt server internals from components.

## Component Naming

Use PascalCase component filenames and names.

```txt
GeneratorWorkspace.vue
DynamicPresetField.vue
RecentOutputs.vue
```

Nuxt auto-imports components from `app/components`. Nested directories affect component names, so keep filenames descriptive enough to read clearly in templates.

Use `.client.vue` only for components that must render in the browser, such as browser-only canvas, file pickers, or APIs that require `window`.

Use the `Lazy` prefix in templates for components that are not immediately needed.

```vue
<LazyRecentOutputs v-if="projectId" />
```

## Composables

Use composables for reusable frontend logic that is not a server cache and not global store state.

```txt
app/composables/
├── useRequiredFields.ts
├── usePromptPreview.ts
├── useWorkflowForm.ts
└── useGenerationStatus.ts
```

Composables are good for:

- Dynamic form state helpers.
- Client-side required field checks.
- Derived prompt preview text.
- DOM or browser interactions.
- Shared behavior across multiple feature components.

Composables are not good for:

- API route strings.
- Long-lived server cache state.
- Provider calls.
- Authorization decisions.

Example:

```ts
export function useRequiredFields() {
  function getMissingRequiredFields(fields: PresetField[], inputs: WorkflowInputs) {
    return fields.filter((field) => field.required && !inputs[field.key])
  }

  return {
    getMissingRequiredFields,
  }
}
```

## Client API Functions

Use `app/api` for typed client functions that call Nuxt server routes.

```txt
app/api/
├── presets.ts
├── expand.ts
├── generate.ts
└── projects.ts
```

Rules:

- Export named functions only.
- Keep route strings in API files.
- Type request and response payloads.
- Use `$fetch` for Nuxt server routes.
- Do not put caching or UI state here.

Example:

```ts
export async function getPresetById(presetId: string) {
  return $fetch<PresetDetailResponse>(`/api/presets/${presetId}`)
}

export async function createProject(request: CreateProjectRequest) {
  return $fetch<ProjectResponse>('/api/projects', {
    method: 'POST',
    body: request,
  })
}
```

## Queries

Use `app/queries` for Pinia Colada query and mutation wrappers.

```txt
app/queries/
├── presets.ts
├── projects.ts
└── generations.ts
```

Queries read server data. Mutations write server data.

| Need | Use |
|---|---|
| Fetch preset list | Pinia Colada query |
| Fetch one project | Pinia Colada query |
| Generate an image | Pinia Colada mutation |
| Save a project | Pinia Colada mutation |
| Toggle local sidebar | Pinia store or local state |
| Track current unsaved form values | Pinia store, composable, or page state |

Example query file:

```ts
import { defineQueryOptions } from '@pinia/colada'

import { getPresetById, getPresets } from '@/api/presets'

export const PRESET_QUERY_KEYS = {
  root: ['presets'] as const,
  byId: (presetId: string) => [...PRESET_QUERY_KEYS.root, presetId] as const,
}

export const presetsQuery = defineQueryOptions({
  key: PRESET_QUERY_KEYS.root,
  query: getPresets,
})

export function presetByIdQuery(presetId: string) {
  return defineQueryOptions({
    key: PRESET_QUERY_KEYS.byId(presetId),
    query: () => getPresetById(presetId),
  })
}
```

Use query keys consistently. Invalidate affected queries after successful mutations.

## Stores

Use `app/stores` for Pinia stores that represent client-owned state.

```txt
app/stores/
├── workflow.ts
└── ui.ts
```

Good store state:

- Current selected preset ID.
- Unsaved workflow inputs.
- Current local generation draft.
- Sidebar open state.
- Recent UI notifications already handled outside Nuxt UI toasts.

Avoid store state for:

- Preset list responses.
- Project detail responses.
- Generation history responses.
- Anything Pinia Colada should cache and invalidate.

Example store shape:

```ts
export const useWorkflowStore = defineStore('workflow', () => {
  const selectedPresetId = ref<string | null>(null)
  const inputs = ref<WorkflowInputs>({})

  function setSelectedPresetId(presetId: string) {
    selectedPresetId.value = presetId
  }

  function setInputValue(key: string, value: WorkflowInputValue) {
    inputs.value[key] = value
  }

  function resetInputs() {
    inputs.value = {}
  }

  return {
    selectedPresetId,
    inputs,
    setSelectedPresetId,
    setInputValue,
    resetInputs,
  }
})
```

## Middleware

Use route middleware for navigation guards.

```txt
app/middleware/
└── auth.ts
```

Rules:

- Protect authenticated routes with `definePageMeta({ middleware: ['auth'] })`.
- Keep authorization source of truth on the server.
- Use middleware for client navigation experience, not data security.

## Plugins

Use `app/plugins` for app-level integrations.

```txt
app/plugins/
├── supabase.client.ts
└── analytics.client.ts
```

Rules:

- Use `.client.ts` for browser-only plugins.
- Use `.server.ts` for server-only app plugins.
- Keep privileged Supabase keys and AI provider keys out of frontend plugins.
- Prefer Nuxt modules when a library has first-class Nuxt support.

## Utils

Use `app/utils` for pure frontend helpers.

```txt
app/utils/
├── formatDate.ts
├── formatError.ts
├── normalizeInputs.ts
└── object.ts
```

Rules:

- Keep helpers pure and easy to test.
- Do not import Vue state, Pinia stores, or Nuxt app context into generic utils.
- Add tests beside helpers that contain branching logic.

## Types

Use `app/types` for shared frontend and API interfaces.

```txt
app/types/
├── api.ts
├── presets.ts
├── projects.ts
├── generations.ts
└── workflow.ts
```

Rules:

- Prefer `interface` over `type` for object shapes.
- Keep feature-specific interfaces near the feature when only one feature uses them.
- Move interfaces to `app/types` when multiple modules import them.
- Avoid duplicating server-owned contracts. Share or mirror API contracts intentionally.

Example:

```ts
export interface WorkflowInputs {
  [key: string]: WorkflowInputValue
}

export interface WorkflowFieldError {
  fieldKey: string
  message: string
}
```

## Feature Ownership

Use domain folders that match product concepts.

| Domain | Owns |
|---|---|
| `auth` | Login UI, session UI, authenticated route entry points |
| `presets` | Preset selection, preset metadata display |
| `generator` | Dynamic form, prompt preview, generate action composition |
| `projects` | Save, load, update, and project list UI |
| `generations` | Output preview, recent outputs, generation thumbnails |
| `usage` | Internal usage views when V1 needs visibility |

Keep cross-domain components in `components/ui` only when they are truly reusable.

## Styling Rules

- Use Tailwind utility classes.
- Use Nuxt UI components before custom markup for common controls.
- Use semantic color tokens from Nuxt UI.
- Avoid manual `<style>` blocks unless a component needs behavior Tailwind cannot express.
- Keep layout spacing consistent with utility classes.
- Keep responsive behavior in templates through Tailwind variants.

Example:

```vue
<template>
  <UCard class="border-muted bg-elevated">
    <template #header>
      <h2 class="text-highlighted text-lg font-semibold">
        Preset
      </h2>
    </template>
  </UCard>
</template>
```

## State Ownership

Use the smallest state owner that matches the data lifecycle.

| State | Owner |
|---|---|
| Text input currently being edited | Component or workflow store |
| Selected preset ID | Workflow store or route query |
| Preset list | Pinia Colada query |
| Project detail | Pinia Colada query |
| Unsaved project inputs | Workflow store |
| Saved project inputs | Backend through API and query cache |
| Generate loading state | Mutation state |
| Sidebar open state | UI store |
| Toasts and overlays | Nuxt UI through `UApp` |

Do not duplicate the same server data in both Pinia Colada and a Pinia store.

## Implementation Order

1. Keep `app/app.vue` wrapped in `UApp` and `NuxtLayout`.
2. Add `app/app.config.ts` for Nuxt UI theme tokens.
3. Add `layouts/default.vue` and `layouts/auth.vue`.
4. Add `components/ui` primitives for empty, error, loading, and section states.
5. Add typed `app/api` functions that match `api-structure.md`.
6. Add Pinia Colada query and mutation wrappers in `app/queries`.
7. Add `stores/workflow.ts` for unsaved generator state.
8. Add feature components for presets, generator workflow, projects, and generations.
9. Add route pages that compose feature components.
10. Add colocated tests for utilities, composables, stores, and feature logic.

## Review Checklist

- Every Vue file uses `<script setup lang="ts">`.
- Components use Nuxt UI and Tailwind classes.
- Components avoid raw API route strings.
- Query files use stable key factories.
- Stores do not duplicate server cache data.
- Tests sit beside the files they cover.
- Route middleware improves UX but does not replace server authorization.
- Generated image assets are rendered from signed URLs, not local frontend assets.
- Provider calls and prompt assembly stay on the server.
- Shared interfaces use `interface` where practical.
