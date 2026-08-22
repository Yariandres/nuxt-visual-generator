import type { PresetConstraints } from '#shared/schemas/preset'
import type {
  TextExpansionAdapter,
  TextExpansionRequest,
  TextExpansionResponse,
} from './types'
import { ProviderError, normalizeProviderError } from './errors'

const PROVIDER = 'openai'

const VALUE_PLACEHOLDER = '{{value}}'
const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_TIMEOUT_MS = 30_000

export interface OpenAITextExpansionAdapterOptions {
  apiKey: string
  model?: string
  baseUrl?: string
  timeoutMs?: number
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  usage?: { prompt_tokens?: number, completion_tokens?: number }
  model?: string
}

export function createOpenAITextExpansionAdapter(
  opts: OpenAITextExpansionAdapterOptions,
): TextExpansionAdapter {
  if (!opts.apiKey) {
    throw new Error('OpenAI adapter requires an apiKey.')
  }
  const model = opts.model ?? DEFAULT_MODEL
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return {
    async expand(req: TextExpansionRequest): Promise<TextExpansionResponse> {
      // v2 mode: a full system `instruction` + assembled user message and an
      // optional per-call model. V1 mode: the `{{value}}` promptTemplate + a
      // constraint-derived system message.
      const isV2 = req.instruction !== undefined
      const callModel = req.model ?? model
      const systemMessage = isV2 ? req.instruction! : buildSystemMessage(req.constraints)
      const userPrompt = isV2 ? buildV2UserMessage(req) : buildV1UserMessage(req)

      const startedAt = Date.now()
      let res: ChatCompletionResponse
      try {
        res = await $fetch<ChatCompletionResponse>('/chat/completions', {
          baseURL: baseUrl,
          method: 'POST',
          headers: { Authorization: `Bearer ${opts.apiKey}` },
          body: {
            model: callModel,
            messages: [
              { role: 'system', content: systemMessage },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
          },
          timeout: timeoutMs,
        })
      } catch (err) {
        throw normalizeProviderError(err, PROVIDER)
      }

      const text = res.choices?.[0]?.message?.content?.trim() ?? ''
      if (text === '') {
        throw new ProviderError({
          provider: PROVIDER,
          category: 'transient',
          message: 'OpenAI returned an empty completion.',
        })
      }

      return {
        text,
        meta: {
          provider: PROVIDER,
          model: res.model ?? callModel,
          latencyMs: Date.now() - startedAt,
        },
        usage: {
          promptTokens: res.usage?.prompt_tokens,
          completionTokens: res.usage?.completion_tokens,
        },
      }
    },
  }
}

// V1 user message: the field's promptTemplate with `{{value}}` filled. Callback
// form keeps `$&`/`$$` in user input from being read as a regex backreference.
function buildV1UserMessage(req: TextExpansionRequest): string {
  return (req.promptTemplate ?? VALUE_PLACEHOLDER).replaceAll(VALUE_PLACEHOLDER, () => req.value)
}

// v2 user message: optional sibling context, then the field value itself when
// `includeFieldValue` is not false.
function buildV2UserMessage(req: TextExpansionRequest): string {
  const parts: string[] = []
  if (req.contextText) parts.push(`Context from other fields:\n${req.contextText}`)
  if (req.includeFieldValue !== false && req.value) parts.push(`Current value:\n${req.value}`)
  return parts.length > 0 ? parts.join('\n\n') : req.value
}

function buildSystemMessage(constraints?: PresetConstraints): string {
  const base
    = 'Rewrite the user description for a professional ad visual prompt. '
      + 'Preserve the user\'s intent. Output ONLY the rewritten text — no preamble, no quotes, no explanation.'
  if (!constraints) return base
  const parts: string[] = []
  if (constraints.mustPreserve.length > 0) {
    parts.push(`Preserve: ${constraints.mustPreserve.join(', ')}.`)
  }
  if (constraints.allowedChanges.length > 0) {
    parts.push(`Allowed changes: ${constraints.allowedChanges.join(', ')}.`)
  }
  if (constraints.qualityRules.length > 0) {
    parts.push(`Quality rules: ${constraints.qualityRules.join(', ')}.`)
  }
  return parts.length === 0 ? base : `${base} ${parts.join(' ')}`
}
