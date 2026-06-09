import { serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'
import { createOpenAITextExpansionAdapter } from '~~/server/services/ai/openai'
import { expandField, type ExpansionErrorCode } from '~~/server/services/ai/expand'
import { loadPreset } from '~~/server/services/presets/loader'
import { estimateOpenAIChatCostCents } from '~~/server/services/usage/pricing'
import { recordUsageEvent } from '~~/server/services/usage/record'

const bodySchema = z.object({
  presetId: z.string().min(1),
  fieldKey: z.string().min(1),
  value: z.string().trim().min(1, 'value cannot be empty').max(2000, 'value too long'),
})

const EXPANSION_STATUS: Record<ExpansionErrorCode, number> = {
  field_not_found: 404,
  wrong_field_type: 400,
  field_not_expandable: 400,
  provider_failure: 502,
}

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: {
        code: 'invalid_payload',
        errors: parsed.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    })
  }
  const { presetId, fieldKey, value } = parsed.data

  const presetResult = await loadPreset(presetId)
  if (!presetResult.ok) {
    if (presetResult.reason === 'not_found') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Preset not found',
        data: { code: 'preset_not_found' },
      })
    }
    console.error(`[expand] preset "${presetId}" failed to load:`, presetResult)
    throw createError({
      statusCode: 500,
      statusMessage: 'Preset is malformed',
      data: { code: 'invalid_preset' },
    })
  }

  const config = useRuntimeConfig()
  if (!config.openaiApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'OpenAI is not configured',
      data: { code: 'openai_not_configured' },
    })
  }

  const adapter = createOpenAITextExpansionAdapter({
    apiKey: config.openaiApiKey,
    model: config.openaiModel,
  })

  const result = await expandField(adapter, presetResult.preset, fieldKey, value)

  if (!result.ok) {
    if (result.error.code === 'provider_failure') {
      // Failed provider calls still get a usage row so BL-031's split-success
      // analytics holds.
      try {
        await recordUsageEvent({
          userId: user.id,
          actionType: 'expand',
          provider: 'openai',
          model: config.openaiModel,
          succeeded: false,
          metadata: { fieldKey, error: result.error.message },
        })
      } catch (err) {
        console.error('[expand] failed to record failed usage event:', err)
      }
    }
    throw createError({
      statusCode: EXPANSION_STATUS[result.error.code],
      statusMessage: result.error.message,
      data: { code: result.error.code },
    })
  }

  try {
    await recordUsageEvent({
      userId: user.id,
      actionType: 'expand',
      provider: result.provider,
      model: result.model,
      succeeded: true,
      estimatedCostCents:
        result.provider === 'openai'
          ? estimateOpenAIChatCostCents(result.model, result.usage ?? {})
          : undefined,
      metadata: {
        fieldKey,
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      },
    })
  } catch (err) {
    console.error('[expand] failed to record usage event:', err)
  }

  return {
    text: result.text,
    provider: result.provider,
    model: result.model,
  }
})
