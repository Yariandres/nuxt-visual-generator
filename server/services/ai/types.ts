import type { PresetConstraints } from '#shared/schemas/preset'

// Provider-agnostic metadata attached to every adapter response so usage
// tracking (BL-031) and cost estimation read a consistent shape regardless of
// which provider served the request.
export interface ProviderResponseMeta {
  provider: string
  model: string
  latencyMs?: number
}

// --- Text expansion (OpenAI today) ---

export interface TextExpansionRequest {
  // The current user input for the field.
  value: string
  // --- V1 mode ---
  // The field's `expand.promptTemplate` from the preset (contains "{{value}}").
  promptTemplate?: string
  // Preset-level constraints passed through so the adapter can steer the model
  // (e.g. via a system message) to preserve them.
  constraints?: PresetConstraints
  // --- v2 mode (per-field aiExpansion) ---
  // A full system instruction that replaces the constraint-derived system
  // message. When present, the adapter runs in v2 mode.
  instruction?: string
  // Sibling-field context assembled from `contextFields`, added to the user
  // message.
  contextText?: string
  // Whether the field's own value is sent to the model.
  includeFieldValue?: boolean
  // Per-call model override (v2 fields choose their own expand model).
  model?: string
}

export interface TextExpansionUsage {
  promptTokens?: number
  completionTokens?: number
}

export interface TextExpansionResponse {
  text: string
  meta: ProviderResponseMeta
  usage?: TextExpansionUsage
}

export interface TextExpansionAdapter {
  expand: (req: TextExpansionRequest) => Promise<TextExpansionResponse>
}

// --- Image generation (Gemini in BL-023) ---

export interface ImageGenerationRequest {
  // The assembled FINAL_PROMPT from the prompt engine (BL-018).
  prompt: string
  // Aspect ratio from the preset's output settings, e.g. "16:9". Adapters honor
  // it when the provider supports it.
  aspectRatio?: string
}

export interface GeneratedImage {
  // Base64-encoded image bytes.
  base64: string
  mimeType: string
}

export interface ImageGenerationResponse {
  image: GeneratedImage
  meta: ProviderResponseMeta
}

export interface ImageGenerationAdapter {
  generate: (req: ImageGenerationRequest) => Promise<ImageGenerationResponse>
}
