// Conversation history for the AI Builder.
//
// Stores the alternating sequence of user requests and assistant JSON outputs
// so multi-turn refinement prompts can include the prior document and prior
// requests verbatim. The assistant turn carries the raw string returned by
// the LLM rather than a parsed AiBuilderDocumentV1: this preserves fidelity
// for re-prompting even when the prior output was malformed (a common case
// the user might want to ask the model to repair).

export type AiBuilderUserTurn = {
  role: 'user'
  request: string
}

export type AiBuilderAssistantTurn = {
  role: 'assistant'
  rawJson: string
}

export type AiBuilderTurn = AiBuilderUserTurn | AiBuilderAssistantTurn

export type AiBuilderHistory = {
  turns: ReadonlyArray<AiBuilderTurn>
}

export const EMPTY_AI_BUILDER_HISTORY: AiBuilderHistory = { turns: [] }

export function appendUserTurn(history: AiBuilderHistory, request: string): AiBuilderHistory {
  return { turns: [...history.turns, { role: 'user', request }] }
}

export function appendAssistantTurn(history: AiBuilderHistory, rawJson: string): AiBuilderHistory {
  return { turns: [...history.turns, { role: 'assistant', rawJson }] }
}

// The most recent assistant output, or null if none yet. Used by the turn
// prompt builder to include the "current document" block on refinement turns.
export function latestAssistantRawJson(history: AiBuilderHistory): string | null {
  for (let i = history.turns.length - 1; i >= 0; i -= 1) {
    const turn = history.turns[i]
    if (turn.role === 'assistant') {
      return turn.rawJson
    }
  }
  return null
}

// User requests in chronological order (assistant turns excluded). Used to
// build the conversation log section of refinement prompts.
export function userRequestLog(history: AiBuilderHistory): ReadonlyArray<string> {
  return history.turns.filter((turn): turn is AiBuilderUserTurn => turn.role === 'user').map((turn) => turn.request)
}

// True when the next prompt should be a refinement (there is an assistant
// turn to revise). False on the very first turn.
export function isRefinementTurn(history: AiBuilderHistory): boolean {
  return latestAssistantRawJson(history) !== null
}
