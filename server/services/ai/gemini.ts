import type {
  ImageGenerationAdapter,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from './types'
import { ProviderError, normalizeProviderError } from './errors'

const PROVIDER = 'gemini'
const DEFAULT_MODEL = 'gemini-2.5-flash-image'
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_TIMEOUT_MS = 60_000

// Candidate finish reasons that mean the provider refused on safety grounds
// rather than failing transiently -- surfaced as a distinct `moderation`
// category so callers never retry them (BL-034).
const MODERATION_FINISH_REASONS: ReadonlySet<string> = new Set([
  'SAFETY',
  'PROHIBITED_CONTENT',
  'IMAGE_SAFETY',
  'BLOCKLIST',
  'SPII',
  'RECITATION',
])

export interface GeminiImageGenerationAdapterOptions {
  apiKey: string
  model?: string
  baseUrl?: string
  timeoutMs?: number
}

interface GeminiInlineData {
  mimeType?: string
  data?: string
}

interface GeminiPart {
  inlineData?: GeminiInlineData
  text?: string
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] }
  finishReason?: string
}

interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[]
  promptFeedback?: { blockReason?: string }
  modelVersion?: string
}

export function createGeminiImageGenerationAdapter(
  opts: GeminiImageGenerationAdapterOptions,
): ImageGenerationAdapter {
  if (!opts.apiKey) {
    throw new Error('Gemini adapter requires an apiKey.')
  }
  const model = opts.model ?? DEFAULT_MODEL
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return {
    async generate(req: ImageGenerationRequest): Promise<ImageGenerationResponse> {
      const generationConfig: Record<string, unknown> = {
        responseModalities: ['IMAGE'],
      }
      // `imageConfig.aspectRatio` is honored by the image-capable models; older
      // models ignore it rather than erroring, so passing it is always safe.
      if (req.aspectRatio) {
        generationConfig.imageConfig = { aspectRatio: req.aspectRatio }
      }

      const startedAt = Date.now()
      let res: GeminiGenerateContentResponse
      try {
        res = await $fetch<GeminiGenerateContentResponse>(
          `/models/${model}:generateContent`,
          {
            baseURL: baseUrl,
            method: 'POST',
            headers: { 'x-goog-api-key': opts.apiKey },
            body: {
              contents: [{ parts: [{ text: req.prompt }] }],
              generationConfig,
            },
            timeout: timeoutMs,
          },
        )
      } catch (err) {
        throw normalizeProviderError(err, PROVIDER)
      }

      if (res.promptFeedback?.blockReason) {
        throw new ProviderError({
          provider: PROVIDER,
          category: 'moderation',
          message: `Gemini blocked the prompt (${res.promptFeedback.blockReason}).`,
        })
      }

      const candidate = res.candidates?.[0]
      if (candidate?.finishReason && MODERATION_FINISH_REASONS.has(candidate.finishReason)) {
        throw new ProviderError({
          provider: PROVIDER,
          category: 'moderation',
          message: `Gemini stopped generation (${candidate.finishReason}).`,
        })
      }

      const inline = candidate?.content?.parts?.find(p => p.inlineData?.data)?.inlineData
      if (!inline?.data) {
        throw new ProviderError({
          provider: PROVIDER,
          category: 'transient',
          message: 'Gemini returned no image data.',
        })
      }

      return {
        image: {
          base64: inline.data,
          mimeType: inline.mimeType ?? 'image/png',
        },
        meta: {
          provider: PROVIDER,
          model: res.modelVersion ?? model,
          latencyMs: Date.now() - startedAt,
        },
      }
    },
  }
}
