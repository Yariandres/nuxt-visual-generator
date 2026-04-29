# REST API Structure Reference

This document defines the V1 REST API shape for Onward. Use it as the implementation reference for Nuxt server routes, client API functions, Pinia Colada queries, and Vue components.

## API Principles

- Keep the backend as the source of truth for presets, prompt assembly, AI provider calls, persistence, storage, and usage tracking.
- Keep Vue components focused on presentation and workflow state. Components call typed client API functions or Pinia Colada queries, not raw route strings.
- Validate every request body, route parameter, and query parameter on the server before touching business logic.
- Return predictable JSON shapes. Do not leak provider SDK errors, stack traces, secrets, filesystem paths, or raw Supabase errors to the client.
- Use user-scoped authorization for projects, generations, usage events, and generated assets.
- Store the exact final prompt used for every generation.

## Directory Structure

Use Nuxt server routes for the REST API and keep domain logic out of route handlers.

```txt
server/
├── api/
│   ├── presets/
│   │   ├── index.get.ts
│   │   └── [presetId].get.ts
│   ├── expand.post.ts
│   ├── generate.post.ts
│   └── projects/
│       ├── index.post.ts
│       └── [projectId]/
│           ├── index.get.ts
│           ├── index.put.ts
│           └── generations.get.ts
├── services/
│   ├── presets/
│   ├── prompt/
│   ├── ai/
│   ├── storage/
│   ├── projects/
│   └── usage/
├── schemas/
│   ├── presets.ts
│   ├── expand.ts
│   ├── generate.ts
│   └── projects.ts
├── utils/
│   ├── auth.ts
│   ├── errors.ts
│   └── validation.ts
└── types/
    ├── api.ts
    ├── presets.ts
    ├── projects.ts
    └── generations.ts
```

Client-side code should stay typed and reusable.

```txt
app/
├── api/
│   ├── presets.ts
│   ├── expand.ts
│   ├── generate.ts
│   └── projects.ts
├── queries/
│   ├── presets.ts
│   ├── projects.ts
│   └── generations.ts
├── components/
├── composables/
└── pages/
```

If the project uses `src/` later, keep the same client folders under `src/`. Nuxt server routes remain in the root `server/` directory.

## Nuxt Route Conventions

- Place REST routes in `server/api`. Nuxt automatically exposes them under `/api`.
- Use HTTP method suffixes: `index.get.ts`, `index.post.ts`, `index.put.ts`.
- Export `defineEventHandler()` from every route file.
- Use `getValidatedRouterParams`, `getValidatedQuery`, and `readValidatedBody` with schemas where possible.
- Use `createError()` for expected failures and a shared mapper for domain errors.
- Pass `event` to `useRuntimeConfig(event)` in server routes that need runtime config.
- Use `event.$fetch` only when forwarding request context to another internal server route is intentional.

Example route shape:

```ts
export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, projectParamsSchema.parse)
  const user = await requireUser(event)

  return getProjectById({
    projectId: params.projectId,
    userId: user.id,
  })
})
```

## Response Envelope

Use direct data for successful responses and a shared error shape for failures.

```ts
export interface ApiErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}
```

Successful list response:

```json
{
  "presets": [
    {
      "id": "visual_scene_v1",
      "name": "Visual Scene Generator",
      "version": "1.0.0",
      "description": "Generate controlled campaign visuals."
    }
  ]
}
```

Successful detail response:

```json
{
  "preset": {
    "id": "visual_scene_v1",
    "name": "Visual Scene Generator",
    "version": "1.0.0",
    "fields": [],
    "constraints": {},
    "output": {
      "type": "image",
      "defaultAspectRatio": "16:9"
    }
  }
}
```

Error response:

```json
{
  "error": {
    "code": "preset_not_found",
    "message": "Preset was not found."
  }
}
```

## Status Codes

- `200 OK`: Read or update succeeded.
- `201 Created`: Project or generation-like resource was created.
- `202 Accepted`: Long-running generation was accepted, if generation becomes asynchronous.
- `400 Bad Request`: Malformed JSON, invalid route parameter, invalid query, or invalid request body.
- `401 Unauthorized`: User is not authenticated.
- `403 Forbidden`: User is authenticated but cannot access the resource.
- `404 Not Found`: Resource does not exist or is not visible to the user.
- `409 Conflict`: Preset version mismatch or conflicting project update.
- `422 Unprocessable Entity`: Payload is valid JSON but fails domain validation.
- `429 Too Many Requests`: Rate limit or quota guard.
- `500 Internal Server Error`: Unexpected server failure.
- `502 Bad Gateway`: AI provider or storage provider failed.
- `503 Service Unavailable`: Provider timeout or temporary dependency outage.

## Endpoints

### `GET /api/presets`

Returns backend-managed preset metadata for selection.

Response:

```ts
export interface PresetListResponse {
  presets: PresetSummary[]
}

export interface PresetSummary {
  id: string
  name: string
  version: string
  description?: string
  outputType: 'image'
}
```

Implementation notes:

- Load presets from the backend source only.
- Validate preset records before returning them.
- Return metadata only. Do not return full prompt templates in the list endpoint unless the UI needs them.

### `GET /api/presets/:presetId`

Returns one validated preset for dynamic UI rendering and generation setup.

Response:

```ts
export interface PresetDetailResponse {
  preset: PresetDefinition
}
```

Implementation notes:

- Validate `presetId`.
- Return `404` for missing presets.
- Return full field definitions, defaults, constraints, and output settings.
- Keep preset filesystem or database details private.

### `POST /api/expand`

Expands one supported text field using a text provider.

Request:

```ts
export interface ExpandRequest {
  presetId: string
  presetVersion: string
  fieldKey: string
  value: string
  inputs: Record<string, string | number | boolean | null>
}
```

Response:

```ts
export interface ExpandResponse {
  fieldKey: string
  value: string
  usageEventId: string
}
```

Implementation notes:

- Require authentication.
- Load and validate the referenced preset.
- Confirm the field exists, is a text field, and has `expand.enabled`.
- Use the field-specific expansion prompt template.
- Preserve user intent and preset constraints.
- Update only the requested field on the client.
- Track usage with provider, model, token estimate, status, and cost estimate when available.

### `POST /api/generate`

Generates an image from a validated preset workflow.

Request:

```ts
export interface GenerateRequest {
  presetId: string
  presetVersion: string
  projectId?: string
  inputs: Record<string, string | number | boolean | null>
  output?: {
    aspectRatio?: string
  }
}
```

Response:

```ts
export interface GenerateResponse {
  generation: GenerationDetail
  asset: GeneratedAsset
  usageEventId: string
}
```

Implementation notes:

- Require authentication.
- Validate all required preset fields.
- Assemble the final prompt on the server.
- Append locked constraints before calling the image provider.
- Create a generation record before calling the provider.
- Store successful assets in private Supabase Storage.
- Return a signed display URL, not a public bucket URL.
- Persist provider metadata, final prompt, status, asset metadata, and failure details.
- Track usage for both successful and failed provider calls.

### `POST /api/projects`

Creates a saved workflow project.

Request:

```ts
export interface CreateProjectRequest {
  name: string
  presetId: string
  presetVersion: string
  inputs: Record<string, string | number | boolean | null>
}
```

Response:

```ts
export interface ProjectResponse {
  project: ProjectDetail
}
```

Implementation notes:

- Require authentication.
- Store owner ID from the authenticated user, never from the request body.
- Validate preset ID, preset version, and input payload.
- Keep `inputs` as structured JSON for preset evolution.

### `GET /api/projects/:projectId`

Loads a saved project.

Response:

```ts
export interface ProjectResponse {
  project: ProjectDetail
}
```

Implementation notes:

- Require authentication.
- Enforce owner access through server checks and Supabase RLS.
- Return `404` instead of exposing whether another user's project exists.
- Include the preset ID and version used by the project.

### `PUT /api/projects/:projectId`

Updates a saved project.

Request:

```ts
export interface UpdateProjectRequest {
  name?: string
  presetId?: string
  presetVersion?: string
  inputs?: Record<string, string | number | boolean | null>
}
```

Response:

```ts
export interface ProjectResponse {
  project: ProjectDetail
}
```

Implementation notes:

- Require authentication.
- Enforce owner access.
- Validate partial updates.
- Use `409` for preset version conflicts that need explicit user handling.

### `GET /api/projects/:projectId/generations`

Returns recent generated outputs for a project.

Query parameters:

```ts
export interface ProjectGenerationsQuery {
  limit?: number
}
```

Response:

```ts
export interface ProjectGenerationsResponse {
  generations: GenerationSummary[]
}
```

Implementation notes:

- Require authentication.
- Enforce project ownership.
- Default to the last 10 generations.
- Cap `limit` on the server.
- Include short-lived signed URLs for private assets.
- Sort newest first.

## Core Types

Keep interfaces close to the code that owns them and export shared API contracts from a central type module.

```ts
export interface ProjectDetail {
  id: string
  name: string
  presetId: string
  presetVersion: string
  inputs: Record<string, string | number | boolean | null>
  createdAt: string
  updatedAt: string
}

export interface GenerationDetail {
  id: string
  projectId?: string
  presetId: string
  presetVersion: string
  status: 'pending' | 'succeeded' | 'failed'
  finalPrompt: string
  provider: 'gemini'
  model: string
  createdAt: string
  completedAt?: string
  errorCode?: string
  errorMessage?: string
}

export interface GeneratedAsset {
  bucket: string
  objectPath: string
  signedUrl: string
  mimeType: string
  width?: number
  height?: number
  fileSize?: number
  checksum?: string
}

export interface GenerationSummary {
  id: string
  projectId?: string
  presetId: string
  presetVersion: string
  status: 'pending' | 'succeeded' | 'failed'
  asset?: GeneratedAsset
  createdAt: string
}
```

## Client API Functions

Create named exports in `app/api`. These functions are the only place client code should call route strings directly.

```ts
export async function getPresets() {
  return $fetch<PresetListResponse>('/api/presets')
}

export async function getPresetById(presetId: string) {
  return $fetch<PresetDetailResponse>(`/api/presets/${presetId}`)
}

export async function expandField(request: ExpandRequest) {
  return $fetch<ExpandResponse>('/api/expand', {
    method: 'POST',
    body: request,
  })
}

export async function generateImage(request: GenerateRequest) {
  return $fetch<GenerateResponse>('/api/generate', {
    method: 'POST',
    body: request,
  })
}
```

## Pinia Colada Queries

Use Pinia Colada for server state that is shared across pages or components.

```ts
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
Use mutations for `POST` and `PUT` calls. Invalidate affected queries after successful writes.

```ts
export const useGenerateImageMutation = defineMutation({
  mutation: generateImage,
})
```

## Vue Usage Guidelines

- Use Composition API with `<script setup lang="ts">`.
- Keep form state local to the workflow page or a feature composable.
- Keep persisted server data in Pinia Colada queries and mutations.
- Use Pinia stores only for app-level UI state or workflow state that is not server-cache data.
- Render loading, empty, success, and error states explicitly.
- Use `state.status` from Pinia Colada when TypeScript narrowing matters in templates.
- Do not assemble prompts, read `.rdt` files, call AI providers, or access storage directly from Vue components.

## Validation and Security Checklist

- Validate all route params, query params, and bodies.
- Authenticate every project, generation, expand, generate, and usage endpoint.
- Authorize by server-derived user ID.
- Enforce Supabase RLS on user-owned tables.
- Keep provider API keys in server-only runtime config.
- Keep Supabase service role keys server-only.
- Return signed URLs for private assets.
- Sanitize user-controlled text before prompt assembly when needed.
- Reject unresolved prompt tokens before provider calls.
- Record usage events for expand and generate operations.
- Persist failed generation attempts with useful status and error metadata.

## Implementation Order

1. Add shared API types and validation schemas.
2. Add preset loading service and `GET /api/presets` routes.
3. Add prompt assembly service.
4. Add text and image provider adapter interfaces.
5. Add `POST /api/expand`.
6. Add storage adapter and generation persistence.
7. Add `POST /api/generate`.
8. Add project save, load, update, and generation history routes.
9. Add client API functions in `app/api`.
10. Add Pinia Colada query and mutation wrappers in `app/queries`.