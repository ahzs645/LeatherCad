// Multi-turn (refinement-aware) prompt builder for the AI Builder.
//
// On the first turn this delegates to renderAiBuilderPrompt so the output is
// identical to the existing single-shot path. On subsequent turns it
// includes the prior assistant document verbatim under "Current document"
// and a prior-request log so the LLM can produce a coherent revision rather
// than regenerating from scratch.

import {
  isRefinementTurn,
  latestAssistantRawJson,
  userRequestLog,
  type AiBuilderHistory,
} from './ai-builder-history'
import { renderAiBuilderPrompt } from './ai-builder-prompt'
import {
  joinSections,
  renderEntitySchemasSection,
  renderOutputContractSection,
  renderPointSchemaSection,
  renderRefinementConstraintsSection,
  renderRefinementIntroSection,
  renderRefinementRequestSection,
  renderTopLevelSchemaSection,
  renderUnsupportedFeaturesSection,
} from './ai-builder-prompt-sections'
import { AI_BUILDER_DEFAULT_REQUEST } from './ai-builder-schema'

export type AiBuilderTurnPromptInput = {
  history: AiBuilderHistory
  request: string
}

function renderCurrentDocumentSection(rawJson: string): string {
  return ['Current document (the JSON you returned previously):', rawJson].join('\n')
}

function renderConversationLogSection(priorRequests: ReadonlyArray<string>): string {
  // Includes the new request explicitly numbered so the model can see how
  // the refinements have evolved.
  const lines = ['Conversation so far:']
  priorRequests.forEach((request, index) => {
    lines.push(`User turn ${index + 1}: ${request}`)
  })
  return lines.join('\n')
}

export function renderAiBuilderTurnPrompt(input: AiBuilderTurnPromptInput): string {
  const normalizedRequest = input.request.trim() || AI_BUILDER_DEFAULT_REQUEST

  if (!isRefinementTurn(input.history)) {
    return renderAiBuilderPrompt(normalizedRequest)
  }

  const priorJson = latestAssistantRawJson(input.history)
  if (priorJson === null) {
    // Defensive: isRefinementTurn returned true so this should not happen.
    return renderAiBuilderPrompt(normalizedRequest)
  }

  const priorRequests = userRequestLog(input.history)

  // Refinement prompts deliberately omit the worked examples block. The
  // current document carries strictly more concrete signal than the
  // examples and we want to keep token cost bounded as the conversation
  // grows. Examples are kept on the first turn via renderAiBuilderPrompt.
  return joinSections([
    renderRefinementIntroSection(),
    renderOutputContractSection(),
    renderRefinementConstraintsSection(),
    renderUnsupportedFeaturesSection(),
    renderTopLevelSchemaSection(),
    renderPointSchemaSection(),
    renderEntitySchemasSection(),
    renderConversationLogSection(priorRequests),
    renderCurrentDocumentSection(priorJson),
    renderRefinementRequestSection(normalizedRequest),
  ])
}
