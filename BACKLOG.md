# Product Backlog

Implementation backlog for Onward, the preset-based AI visual generation app described in `prd.md`.

## Backlog Conventions

- Status values: `Todo`, `In Progress`, `Done`, `Blocked`
- Priority values: `P0` must ship, `P1` should ship, `P2` follow-up
- Estimates are focused engineering effort in business days
- V1 scope excludes team collaboration, marketplace, video workflows, and full Stripe billing

## Milestone 1: Nuxt App Foundation

### BL-001: Create Nuxt 3 Application Baseline

- Priority: `P0`
- Status: `Done`
- Estimate: `0.5-1 day`
- Goal: Initialize the Nuxt 3 app as the foundation for the frontend and server routes.
- Tasks:
  - Create the Nuxt 3 project in this repository.
  - Add base app layout and default landing/workflow route.
  - Confirm Nuxt server routes can run locally.
- Acceptance criteria:
  - App starts locally with the Nuxt dev server.
  - A default page renders without runtime errors.
  - A test server route returns a JSON response.
- Dependencies: None.

### BL-002: Add Nuxt UI and Styling Baseline

- Priority: `P0`
- Status: `Done`
- Estimate: `0.5-1 day`
- Goal: Establish the UI component system for the V1 workflow.
- Tasks:
  - Install and configure Nuxt UI.
  - Add base theme configuration.
  - Define app shell layout for preset selection, form inputs, output preview, and actions.
  - Add shared UI patterns for loading, empty, and error states.
- Acceptance criteria:
  - Nuxt UI components render correctly.
  - App has a basic responsive layout for the generator workflow.
  - Loading and error states are available for feature work.
- Dependencies: BL-001.

### BL-003: Configure Runtime Environment

- Priority: `P0`
- Status: `Done`
- Estimate: `0.5 day`
- Goal: Define the runtime configuration needed by Supabase and AI providers.
- Tasks:
  - Add documented environment variable names for Supabase, OpenAI, and Gemini.
  - Configure public versus server-only runtime config.
  - Add development-safe placeholder examples.
  - Ensure server-only secrets are not exposed to the browser.
- Acceptance criteria:
  - Required variables are documented.
  - Public Supabase values are available client-side.
  - AI provider keys remain server-only.
- Dependencies: BL-001.

### BL-004: Establish Project Structure

- Priority: `P0`
- Status: `Done`
- Estimate: `0.5 day`
- Goal: Create a maintainable folder structure for app, server, shared types, presets, and adapters.
- Tasks:
  - Add conventions for shared types and validation schemas.
  - Reserve `server/api` for backend routes.
  - Reserve `server/services` for preset, prompt, AI, storage, and usage logic.
  - Reserve `engines` for local development `.rdt` preset files.
- Acceptance criteria:
  - New feature work has clear module locations.
  - Local development presets have a defined folder.
  - Backend logic is not mixed into presentation components.
- Dependencies: BL-001.

## Milestone 2: Supabase, Auth, Data, and Storage

### BL-005: Set Up Supabase Integration

- Priority: `P0`
- Status: `Done`
- Estimate: `1-1.5 days`
- Goal: Connect Nuxt to Supabase for Auth, Postgres, and Storage.
- Tasks:
  - Add Supabase client integration for browser usage.
  - Add server-side Supabase access for Nuxt server routes.
  - Document local and hosted Supabase setup expectations.
  - Confirm the service role key is only used server-side when required.
- Acceptance criteria:
  - Client can read authenticated user state.
  - Server routes can access Supabase securely.
  - No privileged Supabase keys are exposed to the frontend.
- Dependencies: BL-003.

### BL-006: Implement Auth Baseline

- Priority: `P0`
- Status: `Done`
- Estimate: `2-3 days`
- Goal: Support the V1 single-user-per-account model with email/password auth, route protection, and layout switching.
- Tasks:
  - Install and configure `@nuxtjs/supabase` module with redirect options.
  - Create auth layout (`auth.vue`) for login/signup pages.
  - Create public layout (`public.vue`) for marketing/public pages.
  - Move generator workspace from `/` to `/generate` route.
  - Add login page (`/login`) with email/password sign-in using `UAuthForm`.
  - Add signup page (`/signup`) with email/password registration.
  - Add confirm page (`/confirm`) for Supabase callback session handling.
  - Add forgot-password page (`/forgot-password`) for password reset requests.
  - Add public landing page placeholder at `/`.
  - Add placeholder public pages: `/blog`, `/contact`, `/privacy`.
  - Configure route protection: public and auth pages excluded from redirect, protected routes require authentication.
  - Ensure backend routes require a valid user where needed.
- Acceptance criteria:
  - Users can sign up with email and password.
  - Users can sign in and sign out.
  - App restores sessions after refresh via SSR cookies.
  - Unauthenticated users are redirected to `/login` when accessing protected routes.
  - Public pages are accessible without authentication.
  - Auth pages use the centered card layout.
  - Protected pages use the workspace shell layout.
  - Authenticated users on `/login` or `/signup` are redirected to `/generate`.
- Dependencies: BL-005.

### BL-007: Define Database Schema

- Priority: `P0`
- Status: `Done`
- Estimate: `1.5-2.5 days`
- Goal: Create the V1 relational data model.
- Tasks:
  - Define `users` or `profiles` table if needed alongside Supabase Auth.
  - Define `presets` table for backend-managed preset metadata.
  - Define `projects` table with JSON input payload support.
  - Define `generations` table with final prompt, provider, status, and asset metadata.
  - Define `usage_events` table for expand and generate tracking.
- Acceptance criteria:
  - Core entities from the PRD are represented.
  - Project inputs can be stored as JSON.
  - Generation records store the exact final prompt used.
  - Usage events can support future billing analytics.
- Dependencies: BL-005.

### BL-008: Add Row Level Security Policies

- Priority: `P0`
- Status: `Done`
- Estimate: `1-2 days`
- Goal: Enforce user-scoped access to projects, generations, usage events, and private assets.
- Tasks:
  - Enable RLS on exposed tables.
  - Add owner-based policies for project records.
  - Add owner-based policies for generation and usage records.
  - Avoid using user-editable metadata for authorization decisions.
- Acceptance criteria:
  - Users can only read and mutate their own project data.
  - Backend-only operations remain protected.
  - RLS policies match the V1 single-user account model.
- Dependencies: BL-007.

### BL-009: Configure Generated Asset Storage

- Priority: `P0`
- Status: `Done`
- Estimate: `1-1.5 days`
- Goal: Store generated images in Supabase Storage with private access by default.
- Tasks:
  - Create `generated-assets` bucket.
  - Keep the bucket private by default.
  - Use object paths matching `user/{userId}/project/{projectId}/generation/{generationId}.{ext}`.
  - Store asset metadata in Postgres.
  - Generate short-lived signed URLs for private asset delivery.
- Acceptance criteria:
  - Generated assets are not publicly accessible by default.
  - App can display a generated image through a signed URL.
  - Asset metadata is linked to its generation record.
- Dependencies: BL-007, BL-008.

## Milestone 3: Preset System

### BL-010: Define `.rdt` Preset Types and Validation

- Priority: `P0`
- Status: `Done`
- Estimate: `1.5-2.5 days`
- Goal: Formalize the preset schema used to render UI and assemble prompts.
- Tasks:
  - Define TypeScript types for preset, fields, constraints, and output settings.
  - Add runtime validation for required preset fields.
  - Support V1 field types including text and select.
  - Validate token references between templates and fields.
  - Validate field-level expansion configuration.
- Acceptance criteria:
  - Invalid presets fail before UI rendering.
  - Required fields, options, templates, constraints, and output settings are validated.
  - Validation errors are actionable for developers.
- Dependencies: BL-004.

### BL-011: Add Local Development Preset Loader

- Priority: `P0`
- Status: `Done`
- Estimate: `1-1.5 days`
- Goal: Load `.rdt` preset files from the local filesystem during development.
- Tasks:
  - Add a sample `visual_scene_v1.rdt` preset.
  - Read presets from the `engines` folder on the server.
  - Validate presets before returning them.
  - Keep filesystem access backend-only.
- Acceptance criteria:
  - Local presets can be listed and loaded.
  - Invalid local presets are rejected.
  - Frontend never reads preset files directly.
- Dependencies: BL-010.

### BL-012: Implement Preset API Routes

- Priority: `P0`
- Status: `Done`
- Estimate: `1-1.5 days`
- Goal: Expose backend routes for preset discovery and loading.
- Tasks:
  - Implement `GET /api/presets`.
  - Implement `GET /api/presets/:id`.
  - Return preset metadata in list responses.
  - Return full validated preset detail for selected presets.
  - Add consistent API error shapes.
- Acceptance criteria:
  - UI can fetch available presets.
  - UI can load a selected preset by ID.
  - Missing or invalid presets return clear errors.
- Dependencies: BL-011.

### BL-013: Add Preset Persistence Strategy

- Priority: `P1`
- Status: `Done`
- Estimate: `0.5-1 day`
- Goal: Prepare the transition from development filesystem presets to backend-managed preset records.
- Tasks:
  - Define how preset metadata is stored in Postgres.
  - Decide whether full preset JSON is stored in DB or loaded from controlled backend files for V1.
  - Add version tracking for preset records.
  - Ensure projects retain the preset ID and version used.
- Acceptance criteria:
  - Preset versioning is explicit.
  - Project and generation records can reference the exact preset version.
  - The implementation path does not require frontend filesystem access.
- Dependencies: BL-007, BL-012.

## Milestone 4: Dynamic Workflow UI

### BL-014: Build Preset Selector

- Priority: `P0`
- Status: `Done`
- Estimate: `0.5-1 day`
- Goal: Let authenticated users select a generation preset.
- Tasks:
  - Fetch preset list from `GET /api/presets`.
  - Render presets in a list or dropdown.
  - Load selected preset details.
  - Handle empty, loading, and error states.
- Acceptance criteria:
  - Users can select an available preset.
  - Selected preset details are loaded once chosen.
  - UI handles missing presets gracefully.
- Dependencies: BL-006, BL-012.

### BL-015: Render Dynamic Preset Form

- Priority: `P0`
- Status: `Done`
- Estimate: `1.5-2 days`
- Goal: Render user inputs from preset field definitions.
- Tasks:
  - Render text fields from preset schema.
  - Render select fields from preset schema options.
  - Support required field indicators.
  - Apply defaults where defined.
  - Preserve input values while editing.
- Acceptance criteria:
  - UI form matches the loaded preset schema.
  - Required fields are visibly marked.
  - Input state updates correctly per field key.
- Dependencies: BL-014.

### BL-016: Add Frontend Workflow State

- Priority: `P0`
- Status: `Done`
- Estimate: `1-1.5 days`
- Goal: Manage current preset, input values, generation status, and recent outputs.
- Tasks:
  - Add state for current preset.
  - Add state for current input values.
  - Add state for generate and expand loading statuses.
  - Add state for recent generated outputs.
  - Reset or migrate state safely when preset changes.
- Acceptance criteria:
  - Workflow state remains consistent during preset changes.
  - Generate and expand actions can show field-specific loading states.
  - Recent outputs can be displayed after generation.
- Dependencies: BL-015.

### BL-017: Add Client-Side Required Field Validation

- Priority: `P0`
- Status: `Done`
- Estimate: `0.5-1 day`
- Goal: Prevent obvious incomplete generation requests before calling the backend.
- Tasks:
  - Validate required fields before generate.
  - Show user-friendly validation errors.
  - Keep backend validation as the source of truth.
- Acceptance criteria:
  - Generate is blocked for missing required values.
  - Users can understand what needs to be fixed.
  - Backend still validates all requests independently.
- Dependencies: BL-015.

## Milestone 5: Prompt Assembly and Text Expansion

### BL-018: Implement Prompt Assembly Engine

- Priority: `P0`
- Status: `Done`
- Estimate: `1-1.5 days`
- Goal: Build final prompts from preset templates, user inputs, and locked constraints.
- Tasks:
  - Replace template tokens with validated user input values.
  - Detect missing or unresolved tokens.
  - Append locked constraint suffix.
  - Include must-preserve, allowed-change, and quality-rule constraints.
  - Return final prompt for generation persistence.
- Acceptance criteria:
  - `FINAL_PROMPT = TEMPLATE_WITH_REPLACED_TOKENS + LOCKED_CONSTRAINT_SUFFIX`.
  - Missing required input fails clearly.
  - Final prompt includes preset constraints.
- Dependencies: BL-010.

### BL-019: Add OpenAI Text Expansion Adapter

- Priority: `P0`
- Status: `Done`
- Estimate: `1.5-2 days`
- Goal: Expand individual text field values using a text model without changing the rest of the form.
- Tasks:
  - Create provider adapter interface for text expansion.
  - Implement OpenAI adapter.
  - Use field-specific `expand.promptTemplate`.
  - Preserve user intent and preset constraints in the expansion request.
  - Return only the expanded value for the targeted field.
- Acceptance criteria:
  - Expansion uses a text model only.
  - Expansion only updates the requested field.
  - Fields without expansion config cannot call expansion.
- Dependencies: BL-003, BL-010.

### BL-020: Implement `POST /api/expand`

- Priority: `P0`
- Status: `Done`
- Estimate: `1-1.5 days`
- Goal: Provide backend-controlled field-level text expansion.
- Tasks:
  - Validate request payload.
  - Load and validate the referenced preset.
  - Validate field exists and supports expansion.
  - Call the text expansion adapter.
  - Track usage event with provider metadata and estimated cost when available.
- Acceptance criteria:
  - Endpoint returns an expanded text value.
  - Endpoint rejects unsupported fields.
  - Usage event is recorded for successful expansion.
- Dependencies: BL-012, BL-019, BL-031.

### BL-021: Add Expand With AI UI

- Priority: `P0`
- Status: `Done`
- Estimate: `1-1.5 days`
- Goal: Let users expand supported text fields from the dynamic form.
- Tasks:
  - Show an `Expand with AI` action only for supported text fields.
  - Send current field value to `POST /api/expand`.
  - Update only the targeted field with the returned value.
  - Show field-specific loading and error states.
- Acceptance criteria:
  - Supported text fields can be expanded.
  - Other fields are unaffected by expansion.
  - Errors do not overwrite existing user input.
- Dependencies: BL-020, BL-016.

## Milestone 6: Image Generation

### BL-022: Add AI Provider Adapter Abstraction

- Priority: `P0`
- Status: `Done`
- Estimate: `0.5-1 day`
- Goal: Keep provider-specific code isolated from core workflow logic.
- Tasks:
  - Define shared adapter interfaces for text and image providers.
  - Keep OpenAI and Gemini implementations behind adapters.
  - Normalize provider responses and errors.
  - Include provider request metadata for usage tracking.
- Acceptance criteria:
  - Core generation logic does not depend directly on provider SDKs.
  - Provider errors are mapped into consistent app errors.
  - New providers can be added without changing UI workflow code.
- Dependencies: BL-019.

### BL-023: Add Gemini Image Generation Adapter

- Priority: `P0`
- Status: `Todo`
- Estimate: `1.5-2.5 days`
- Goal: Generate images from assembled prompts using Gemini.
- Tasks:
  - Implement Gemini image provider adapter.
  - Pass final prompt and output settings such as aspect ratio.
  - Handle provider errors, moderation responses, and timeouts.
  - Return generated image data or a temporary provider asset reference.
- Acceptance criteria:
  - Backend can request an image from Gemini.
  - Aspect ratio from preset output settings is respected when supported.
  - Provider failures are surfaced clearly.
- Dependencies: BL-022, BL-003.

### BL-024: Implement `POST /api/generate`

- Priority: `P0`
- Status: `Todo`
- Estimate: `2-3 days`
- Goal: Generate a visual through the controlled preset workflow.
- Tasks:
  - Validate request payload.
  - Load and validate selected preset.
  - Validate required inputs.
  - Assemble final prompt.
  - Create generation record with pending status.
  - Call Gemini image generation adapter.
  - Store generated asset through storage adapter.
  - Update generation record with status, prompt, provider metadata, and asset metadata.
  - Track usage event.
- Acceptance criteria:
  - Endpoint returns generation metadata and displayable asset URL.
  - Final prompt is persisted.
  - Failed generations are recorded with useful status/error information.
  - Successful generation records are linked to the authenticated user and project when present.
- Dependencies: BL-018, BL-023, BL-026, BL-031.

### BL-025: Add Generate UI and Output Preview

- Priority: `P0`
- Status: `Todo`
- Estimate: `1.5-2 days`
- Goal: Let users generate and review images from the workflow page.
- Tasks:
  - Add generate action to the dynamic form.
  - Call `POST /api/generate`.
  - Show generation progress state.
  - Render generated image preview.
  - Surface backend validation and provider errors.
- Acceptance criteria:
  - Users can generate an image from valid inputs.
  - Generated image appears in the workflow UI.
  - Generate button handles loading and disabled states correctly.
- Dependencies: BL-024, BL-017.

### BL-026: Add Storage Adapter

- Priority: `P0`
- Status: `Todo`
- Estimate: `1-1.5 days`
- Goal: Keep storage implementation swappable for future S3 migration.
- Tasks:
  - Define storage adapter interface.
  - Implement Supabase Storage adapter.
  - Centralize object path generation.
  - Centralize signed URL creation.
- Acceptance criteria:
  - Generation flow stores assets through an adapter.
  - Object paths follow the PRD convention.
  - Business logic does not depend directly on Supabase Storage APIs.
- Dependencies: BL-009.

## Milestone 7: Projects and Generation History

### BL-027: Implement Project Save and Load APIs

- Priority: `P0`
- Status: `Todo`
- Estimate: `1.5-2.5 days`
- Goal: Persist user workflow state as projects.
- Tasks:
  - Implement `POST /api/projects`.
  - Implement `GET /api/projects/:id`.
  - Implement `PUT /api/projects/:id`.
  - Store preset ID, preset version, and input JSON.
  - Enforce authenticated ownership.
- Acceptance criteria:
  - Users can create a project.
  - Users can load an existing project.
  - Users can update project inputs.
  - Users cannot access another user's projects.
- Dependencies: BL-006, BL-007, BL-008.

### BL-028: Add Project Save and Load UI

- Priority: `P0`
- Status: `Todo`
- Estimate: `1-2 days`
- Goal: Let users save current inputs and restore a saved project.
- Tasks:
  - Add save project action.
  - Add project load flow.
  - Restore preset and input state from project data.
  - Handle preset version mismatch gracefully.
- Acceptance criteria:
  - Users can save current workflow state.
  - Users can reopen a saved project.
  - Restored project inputs populate the dynamic form.
- Dependencies: BL-027, BL-016.

### BL-029: Implement Project Generation History API

- Priority: `P0`
- Status: `Todo`
- Estimate: `1-1.5 days`
- Goal: Return recent generation records for a project.
- Tasks:
  - Implement `GET /api/projects/:id/generations`.
  - Limit recent results to the last 10 by default.
  - Include signed URLs for private assets.
  - Enforce project ownership.
- Acceptance criteria:
  - Endpoint returns the last 10 project outputs.
  - Returned assets are displayable through signed URLs.
  - Users cannot read another user's generation history.
- Dependencies: BL-024, BL-027.

### BL-030: Add Recent Outputs UI

- Priority: `P0`
- Status: `Todo`
- Estimate: `1-1.5 days`
- Goal: Show the last 10 generated outputs for the current project.
- Tasks:
  - Fetch generation history for loaded projects.
  - Add new successful generations to recent outputs.
  - Render thumbnails or image previews.
  - Handle empty history.
- Acceptance criteria:
  - Users can review recent generated outputs.
  - Recent outputs update after a successful generation.
  - Only the last 10 outputs are shown for V1.
- Dependencies: BL-029, BL-025.

## Milestone 8: Usage Tracking and Billing Readiness

### BL-031: Implement Usage Event Service

- Priority: `P0`
- Status: `Done`
- Estimate: `1-1.5 days`
- Goal: Track usage for future billing and analytics.
- Tasks:
  - Define usage event types for `expand` and `generate`.
  - Capture provider, model, request metadata, and estimated cost where available.
  - Link usage events to user, project, and generation when applicable.
  - Ensure failed and successful provider calls can be analyzed separately.
- Acceptance criteria:
  - Expansion calls create usage events.
  - Generation calls create usage events.
  - Events are queryable by user, project, provider, and action type.
- Dependencies: BL-007, BL-008.

### BL-032: Add Internal Usage Review View

- Priority: `P1`
- Status: `Todo`
- Estimate: `0.5-1 day`
- Goal: Provide simple visibility into usage before full billing exists.
- Tasks:
  - Add a basic authenticated usage summary route or admin-only server response.
  - Show counts for expansion and generation events.
  - Show estimated cost totals where available.
- Acceptance criteria:
  - Usage can be inspected during development and testing.
  - Summary does not expose other users' data.
  - Billing integration remains out of V1 scope.
- Dependencies: BL-031.

## Milestone 9: Reliability, Quality, and Security Hardening

### BL-033: Add Request Validation and Sanitization

- Priority: `P0`
- Status: `Todo`
- Estimate: `1-2 days`
- Goal: Validate all incoming backend payloads before using them.
- Tasks:
  - Validate preset IDs, project IDs, field keys, and input payloads.
  - Sanitize user-controlled text before prompt assembly where appropriate.
  - Return consistent validation errors.
  - Add tests for invalid payloads.
- Acceptance criteria:
  - Backend rejects malformed requests.
  - Validation errors are consistent across API routes.
  - Prompt assembly never runs with unvalidated required fields.
- Dependencies: BL-010, BL-012, BL-020, BL-024, BL-027.

### BL-034: Add Provider Error Handling and Retries

- Priority: `P0`
- Status: `Todo`
- Estimate: `1-2 days`
- Goal: Make provider failures understandable and recoverable.
- Tasks:
  - Normalize provider timeout, moderation, quota, and transient errors.
  - Add conservative retry behavior for safe transient failures.
  - Avoid retrying validation or policy failures.
  - Persist failure status for generation attempts.
- Acceptance criteria:
  - Users receive useful error messages.
  - Transient failures can retry safely.
  - Failed generation records remain auditable.
- Dependencies: BL-020, BL-024.

### BL-035: Add Constraint Quality Checks

- Priority: `P1`
- Status: `Todo`
- Estimate: `1-1.5 days`
- Goal: Improve consistency against preset constraints.
- Tasks:
  - Add pre-generation checks that required constraints are present in the final prompt.
  - Add post-generation metadata flags for quality review.
  - Identify basic failure categories such as distortion, duplication, or scale issues when manually reviewed.
- Acceptance criteria:
  - Final prompts include must-preserve and quality rules.
  - Quality review data can be stored for future improvements.
  - V1 does not claim fully automated quality approval.
- Dependencies: BL-018, BL-024.

### BL-036: Add Core Tests

- Priority: `P0`
- Status: `Todo`
- Estimate: `2-3 days`
- Goal: Cover the riskiest V1 workflow logic.
- Tasks:
  - Test preset validation.
  - Test prompt assembly and unresolved token handling.
  - Test request validation for expand and generate.
  - Test project ownership access rules where feasible.
  - Test storage path generation.
- Acceptance criteria:
  - Core workflow logic has automated coverage.
  - Tests cover both success and failure paths.
  - Tests can run locally in CI-ready form.
- Dependencies: BL-010, BL-018, BL-020, BL-024, BL-027.

### BL-037: Prepare Internal MVP Demo

- Priority: `P0`
- Status: `Todo`
- Estimate: `1-2 days`
- Goal: Reach a demoable end-to-end workflow around week 4-5.
- Tasks:
  - Confirm one complete preset works end to end.
  - Confirm auth, project save/load, expansion, generation, storage, and recent outputs work together.
  - Prepare known limitations list.
  - Capture feedback on prompt quality and UX.
- Acceptance criteria:
  - A user can sign in, select a preset, fill inputs, expand a field, generate an image, save a project, and view recent outputs.
  - Demo limitations are documented.
  - Feedback can be converted into follow-up backlog items.
- Dependencies: BL-021, BL-025, BL-028, BL-030.

### BL-038: Production Readiness Pass

- Priority: `P0`
- Status: `Todo`
- Estimate: `2-3 days`
- Goal: Stabilize V1 before launch or broader testing.
- Tasks:
  - Review environment variable handling.
  - Review RLS and storage access policies.
  - Review API error behavior.
  - Review provider quota and timeout handling.
  - Confirm deployment configuration.
  - Confirm no team, marketplace, video, or billing scope leaked into V1.
- Acceptance criteria:
  - V1 can be deployed with documented configuration.
  - Security-sensitive paths are reviewed.
  - Known risks are documented before launch.
- Dependencies: BL-033, BL-034, BL-036, BL-037.

## Suggested Build Sequence

1. BL-001 through BL-004: Create the Nuxt foundation and project structure.
2. BL-005 through BL-009: Connect Supabase, Auth, Postgres, RLS, and Storage.
3. BL-010 through BL-013: Make presets loadable, validated, and version-aware from the backend.
4. BL-014 through BL-017: Build the dynamic workflow UI.
5. BL-018, BL-019, and BL-031: Add prompt assembly, text provider wiring, and usage tracking before provider endpoints.
6. BL-020 through BL-021: Add field-level text expansion.
7. BL-022, BL-023, and BL-026: Add provider and storage adapters.
8. BL-024 through BL-025: Add image generation endpoint and UI.
9. BL-027 through BL-030: Add projects and recent outputs.
10. BL-032: Add usage review visibility.
11. BL-033 through BL-038: Harden, test, demo, and prepare for deployment.

## V1 Completion Checklist

- User can authenticate.
- User can select a backend-served preset.
- UI renders dynamically from the preset schema.
- Required preset inputs are validated.
- Supported text fields can be expanded with AI.
- Final prompts are assembled from templates, tokens, and constraints.
- Images are generated through Gemini.
- Generated assets are stored privately and delivered with signed URLs.
- Projects can be saved and loaded.
- The last 10 project outputs are visible.
- Usage events are tracked for expansion and generation.
- RLS protects user-scoped data.
- Core validation, prompt, storage, and API paths are tested.
