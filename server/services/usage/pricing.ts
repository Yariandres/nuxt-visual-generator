// V1 cost-estimation lookup. Prices are USD-per-million-tokens for chat models
// and USD-per-image for image models. Verify against the provider's published
// pricing before any production billing decision — these are estimates only.

export interface ChatTokenUsage {
  promptTokens?: number
  completionTokens?: number
}

interface ChatPrice {
  promptPerMillion: number
  completionPerMillion: number
}

const OPENAI_CHAT_PRICES: Record<string, ChatPrice> = {
  'gpt-4o-mini': { promptPerMillion: 0.15, completionPerMillion: 0.60 },
}

const GEMINI_IMAGE_PRICES_PER_IMAGE: Record<string, number> = {
  // Estimate for the default image model (~1290 output tokens/image at the
  // published image-output rate). Verify against current Gemini pricing before
  // any billing decision.
  'gemini-2.5-flash-image': 0.039,
}

export function estimateOpenAIChatCostCents(
  model: string,
  usage: ChatTokenUsage,
): number | undefined {
  const price = OPENAI_CHAT_PRICES[model]
  if (!price) return undefined
  const promptTokens = usage.promptTokens ?? 0
  const completionTokens = usage.completionTokens ?? 0
  const usd
    = (promptTokens / 1_000_000) * price.promptPerMillion
      + (completionTokens / 1_000_000) * price.completionPerMillion
  return Math.round(usd * 100)
}

export function estimateGeminiImageCostCents(
  model: string,
  imageCount = 1,
): number | undefined {
  const perImageUsd = GEMINI_IMAGE_PRICES_PER_IMAGE[model]
  if (perImageUsd === undefined) return undefined
  return Math.round(perImageUsd * imageCount * 100)
}
