PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 1) Product Overview

### Product Name
Working name: Onward (AI Workflow App / Preset-based Visual Generator)

### Description
A web application for controlled visual generation using AI, designed for professional creative teams. Users generate high-quality visuals through structured workflows (presets) instead of raw prompting.

### Core Product Positioning
This is not a one-click AI generator.
This is a constrained and repeatable generation tool where users operate inside predefined logic, rules, and steps.

### Target Users
- Graphic designers
- Art directors
- Creative agencies
- Marketing teams

### Primary Use Cases
- Product visualizations
- Campaign key visuals (KV)
- Lifestyle scenes
- Advertising creatives

## 2) Core Concept

The system is based on engine-driven generation.

Instead of writing prompts manually, users:
1. Load a preset (`.rdt`, internal JSON format)
2. Fill structured inputs
3. Generate outputs through controlled logic

### Product Principles
- Repeatability
- Control
- Production quality
- Constraint-based generation

## 3) V1 Scope (Must Ship)

V1 includes:
1. Preset loading from backend (`.rdt`)
2. Dynamic UI rendering from preset field definitions
3. Prompt assembly using template + tokens
4. Field-level "Expand with AI" for text inputs
5. Image generation using selected provider
6. Project save/load (single user)
7. Recent outputs cache (last 10 per project)
8. Usage tracking events (for future billing)

V1 excludes:
- Team collaboration
- Marketplace
- Video generation workflows
- Full Stripe billing integration

## 4) System Architecture (V1 Decision)

### Frontend
- Nuxt 3 (SPA behavior)
- Pure presentation and workflow state
- Renders UI dynamically from preset schema

### Backend
- Nuxt server routes as source of truth
- Owns preset loading/validation, project persistence, AI requests, usage tracking

### Data and Storage
- Supabase Postgres (managed database)
- Supabase Auth (user identity)
- Supabase Storage (generated assets and cacheable outputs)
- Local filesystem (development fallback only):
  - `/engines` for local preset files during development
  - `/cache` for local temporary outputs during development

### AI Providers
- OpenAI for text expansion
- Gemini for image generation

### Database Decision (V1): Supabase Postgres
We are choosing Supabase (Postgres) as the V1 data platform.

Reasons:
1. Relational fit for core entities: users, presets, projects, generations, usage events
2. SQL analytics readiness for usage-based billing, reporting, and quality insights
3. Flexible `jsonb` support for evolving preset/project input payloads without losing structure
4. Built-in Auth + RLS + Storage reduces infrastructure complexity in V1
5. Better long-term maintainability than document-first modeling for this workflow

Why not MongoDB for V1:
- MongoDB is viable, but this product has strongly relational workflows and future reporting needs.
- Postgres provides stronger querying and consistency patterns for generation history, usage tracking, and billing-oriented rollups.

## 5) Preset System Specification (`.rdt`)

### Purpose
Defines:
- UI structure
- Prompt logic
- Parameters and validation
- Field-specific expansion behavior
- Generation constraints

### Responsibilities
- Define token map
- Define UI inputs
- Define dependencies and defaults
- Define field-level expansion prompt templates

### Minimum Schema (V1)
```json
{
  "id": "visual_scene_v1",
  "name": "Visual Scene Generator",
  "version": "1.0.0",
  "template": "Create a {{STYLE}} scene of {{SUBJECT}} in {{ENVIRONMENT}} with {{LIGHTING}}.",
  "fields": [
    {
      "key": "STYLE",
      "label": "Style",
      "type": "select",
      "required": true,
      "options": ["photoreal", "editorial", "minimal"]
    },
    {
      "key": "SUBJECT",
      "label": "Subject",
      "type": "text",
      "required": true,
      "expand": {
        "enabled": true,
        "promptTemplate": "Expand this subject description for premium ad visual quality: {{value}}"
      }
    }
  ],
  "constraints": {
    "mustPreserve": ["shape", "proportions", "labels", "branding"],
    "allowedChanges": ["environment", "lighting", "composition"],
    "qualityRules": ["realistic scale", "no duplication", "no distortion"]
  },
  "output": {
    "type": "image",
    "defaultAspectRatio": "16:9"
  }
}
```

## 6) Prompt Assembly Logic

### Process
1. Load `.rdt`
2. Collect user inputs
3. Validate required fields
4. Replace template tokens
5. Append locked constraint suffix
6. Persist final prompt with generation record

### Token Examples
- `{{STYLE}}`
- `{{SCENE_STRUCTURE}}`
- `{{USER_THEME}}`

### Assembly Rule
`FINAL_PROMPT = TEMPLATE_WITH_REPLACED_TOKENS + LOCKED_CONSTRAINT_SUFFIX`

## 7) Project System

### Purpose
Stores user session state and generation history linkage.

### V1 Project Shape
```json
{
  "engine_id": "visual_scene_v1",
  "version": "1.0",
  "inputs": {
    "theme": "...",
    "mood": "...",
    "ratio": "16:9"
  }
}
```

### Future Expansion
- Thumbnails
- History snapshots
- Asset attachments

## 8) User Flow (V1)

1. User opens app
2. User selects preset
3. UI loads dynamically from preset fields
4. User fills inputs
5. Optional: user clicks Expand with AI on specific text fields
6. User clicks Generate
7. User reviews result
8. User adjusts inputs and re-generates
9. User saves project

## 9) Expand with AI (Text Assist)

### Behavior
- Sends current field value to text model
- Uses field-specific prompt template defined in `.rdt`
- Returns improved/expanded text and updates only the targeted field

### Requirements
- Must use text model only
- Must be field-specific
- Must preserve user intent and fit preset constraints

## 10) AI Integration

### Text Expansion
- OpenAI text models

### Image Generation
- Gemini image model

### Provider Adapter Requirement
Backend uses adapter abstraction so provider switching does not affect core workflow logic.

## 11) Constraints and Rules (Critical)

### Must Preserve
- Shape
- Proportions
- Labels
- Branding

### Allowed Variation
- Environment
- Lighting
- Composition

### Must Enforce
- Realistic scale
- No duplication
- No distortion

## 12) Preset Loading System

Requirements:
1. Fetch available `.rdt` files from backend
2. Display selectable list/dropdown
3. Load selected preset
4. Validate schema before rendering UI

## 13) State Management

### Frontend State
- Current preset
- Current input values
- Current generation status
- Recent generated outputs

### Backend State
- Users
- Presets
- Projects
- Generations
- Usage events

## 14) API Surface (V1)

- `GET /api/presets`
- `GET /api/presets/:id`
- `POST /api/expand`
- `POST /api/generate`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PUT /api/projects/:id`
- `GET /api/projects/:id/generations`

## 15) Data Model (V1)

### Entities
- `users`
- `presets`
- `projects`
- `generations`
- `usage_events`

### Notes
- Store final prompt used per generation
- Track provider usage per expand/generate call
- Keep project inputs as JSON for flexible preset evolution

## 15.1) Image Storage Strategy (V1)

### Decision
Use Supabase Storage as the primary image/object storage layer (S3-style object storage pattern).

### Why
- Tight integration with Supabase Auth and RLS for user/project-scoped access control
- Lower infrastructure complexity for V1 than introducing a separate storage platform
- Supports signed URLs for secure private asset delivery
- Scales for generation-heavy workflows while keeping metadata in Postgres

### Bucket and Access Model
- `generated-assets` bucket: private by default
- Optional public bucket only for explicit shareable previews
- Deliver private assets through short-lived signed URLs

### Object Path Convention
`user/{userId}/project/{projectId}/generation/{generationId}.{ext}`

### Metadata Ownership
Store asset metadata in Postgres (`generations` and/or asset table):
- bucket
- object_path
- mime_type
- file_size
- width/height
- checksum
- created_at

### Portability Note
Implement storage through an adapter interface so we can swap to AWS S3 later without changing generation/business logic.

## 16) User System

### Phase 1
- Single user per account

### Future
- Companies
- Multi-user workspaces
- Seat management

## 16.1) Authentication and Route Access (V1)

### Auth Method
- Email + password via Supabase Auth
- Session management through `@nuxtjs/supabase` module (cookie-based SSR sessions, PKCE flow)

### Page Categories

| Category | Layout | Auth Required | Pages |
|---|---|---|---|
| Public | Marketing shell (logo, nav, sign-in CTA, footer) | No | `/`, `/blog`, `/contact`, `/privacy` |
| Auth | Centered card, no chrome | No | `/login`, `/signup`, `/confirm`, `/forgot-password` |
| Protected | Authenticated workspace shell | Yes | `/generate`, `/projects`, `/settings` |

### Auth Pages
- `/login` — email/password sign-in
- `/signup` — email/password registration
- `/confirm` — Supabase callback handler (session confirmation after email verification or OAuth redirect)
- `/forgot-password` — password reset request

### Public Pages (V1 Placeholders)
- `/` — public landing page
- `/blog` — placeholder
- `/contact` — placeholder
- `/privacy` — placeholder

### Route Protection
- Unauthenticated users accessing protected routes are redirected to `/login`
- Public and auth pages are accessible without authentication
- Session is restored automatically on page refresh via SSR cookies
- Authenticated users on auth pages (login, signup) are redirected to `/generate`

## 17) Billing System

### Model
- Usage-based

### V1 Requirement
- Track usage and estimated cost only

### Future
- Markup rules
- Stripe integration

## 18) Security

- Presets are stored and served from backend only
- Frontend does not have direct filesystem access
- Validate and sanitize all request payloads
- Enforce Row Level Security (RLS) policies in Supabase for user-scoped data access
- Optional `.rdt` encryption can be added later

## 19) Non-Goals

- No one-click "generate everything"
- No beginner-oriented UX
- No fully autonomous AI decisioning

## 20) Success Criteria

- User can generate consistent outputs using presets
- Same inputs produce semantically similar results
- Prompt randomness is reduced versus free prompting
- Outputs are suitable for production creative workflows

## 21) Delivery Plan (Suggested)

### Phase 1 (Foundation)
- Nuxt app + server route baseline
- Supabase project setup (Postgres, Auth, Storage)
- Preset loader and validation

### Phase 2 (Core Workflow)
- Dynamic form renderer
- Prompt assembly engine
- Expand with AI endpoint and UI

### Phase 3 (Generation and Persistence)
- Image generation endpoint
- Save/load project
- Recent outputs

### Phase 4 (Hardening)
- Error handling and retries
- Usage tracking accuracy
- Quality checks against constraints

## 22) Future Extensions

- Video generation workflows
- Advanced asset management
- Team collaboration
- Preset marketplace

## 23) Development Estimate (1 Full-Stack Developer)

### Estimation Assumptions
- Figma mockups are complete and approved
- Nuxt UI component library is used for most UI building blocks
- Scope is limited to V1 defined in this PRD
- One full-stack developer with Nuxt and Supabase experience
- AI provider credentials and access are ready

### Timeline Estimate

#### Optimistic
5-7 weeks

#### Realistic (recommended planning baseline)
7-9 weeks

#### Conservative (with unknowns and iteration)
10-12 weeks

### Effort Breakdown (Realistic Scenario)
1. Project setup, Supabase setup, auth baseline, environments: 4-6 days
2. Preset system (`.rdt`) parsing/validation and dynamic form rendering: 6-8 days
3. Prompt assembly engine + field-level "Expand with AI": 5-7 days
4. Image generation integration + provider adapter + retries: 5-7 days
5. Project save/load + generation history + recent outputs: 4-6 days
6. Storage integration (Supabase Storage, signed URLs, metadata): 3-4 days
7. Usage tracking and billing-ready event model: 3-4 days
8. QA, bug fixing, reliability hardening, and deploy prep: 7-10 days

### Main Risks That Affect Timeline
- AI provider response variability and moderation/error edge cases
- Preset schema changes during implementation
- Access control and RLS policy tuning
- Prompt quality tuning for consistency across presets

### Suggested Delivery Milestone
Plan for an internal MVP demo at week 4-5, then 2-4 additional weeks for stabilization and production readiness.
