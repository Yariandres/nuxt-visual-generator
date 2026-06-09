import type { PresetConstraints } from '#shared/schemas/preset'

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
  provider: string
  model: string
  usage?: TextExpansionUsage
}

export interface TextExpansionAdapter {
  expand: (req: TextExpansionRequest) => Promise<TextExpansionResponse>
}
