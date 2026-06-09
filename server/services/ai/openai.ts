import type { PresetConstraints } from '#shared/schemas/preset'
import type {
  TextExpansionAdapter,
  TextExpansionRequest,
  TextExpansionResponse,
} from './types'

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
      // Replace via callback form so `$&`/`$$` in user input is not interpreted
      // as a regex backreference.
      const userPrompt = req.promptTemplate.replaceAll(
        VALUE_PLACEHOLDER,
        () => req.value,
      )

      const res = await $fetch<ChatCompletionResponse>('/chat/completions', {
        baseURL: baseUrl,
        method: 'POST',
        headers: { Authorization: `Bearer ${opts.apiKey}` },
        body: {
          model,
          messages: [
            { role: 'system', content: buildSystemMessage(req.constraints) },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
        },
        timeout: timeoutMs,
      })

      const text = res.choices?.[0]?.message?.content?.trim() ?? ''
      if (text === '') {
        throw new Error('OpenAI returned an empty completion.')
      }

      return {
        text,
        provider: 'openai',
        model: res.model ?? model,
        usage: {
          promptTokens: res.usage?.prompt_tokens,
          completionTokens: res.usage?.completion_tokens,
        },
      }
    },
  }
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
