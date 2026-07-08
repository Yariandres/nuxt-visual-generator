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
  // The field's `expand.promptTemplate` from the preset (contains "{{value}}").
  promptTemplate: string
  // The current user input for the field.
  value: string
  // Preset-level constraints passed through so the adapter can steer the model
  // (e.g. via a system message) to preserve them.
  constraints?: PresetConstraints
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
