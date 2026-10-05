import { formatDollars } from '../format'
import {
  groupConversations,
  newestSample,
  UNGROUPED_CONVERSATION_ID,
} from '../usage/groupConversations'
import type { UsageQuery } from '../usage/types'
import {
  aboutPromptTokens,
  buildConversationOptimizePrompt,
} from './conversationOptimizePrompt'

export type ConversationSessionPayload = {
  id: string
  title: string
  queryCount: number
  costLabel: string
  chars: number
  aboutTokens: number
  /** Display only. The host rebuilds the prompt on Run and ignores this string. */
  prompt: string
  optimizable: boolean
}

export type ConversationSessionOptions = {
  limit?: number
  titles?: Readonly<Record<string, string>>
  accountSpend?: boolean
  projectLabel?: string
}

export function toConversationSessions(
  queries: readonly UsageQuery[],
  options: ConversationSessionOptions = {},
): ConversationSessionPayload[] {
  const sample =
    options.limit === undefined
      ? [...queries]
      : newestSample(queries, options.limit)
  const groups = groupConversations(sample, options.titles)
  return groups.map((group) => {
    const optimizable = group.id !== UNGROUPED_CONVERSATION_ID
    const prompt = optimizable
      ? buildConversationOptimizePrompt(group, {
          accountSpend: options.accountSpend === true,
          projectLabel: options.projectLabel,
        })
      : ''
    const cost = group.queries.reduce((sum, query) => sum + query.costUsd, 0)
    return {
      id: group.id,
      title: group.title,
      queryCount: group.queries.length,
      costLabel: formatDollars(cost),
      chars: prompt.length,
      aboutTokens: aboutPromptTokens(prompt),
      prompt,
      optimizable,
    }
  })
}
