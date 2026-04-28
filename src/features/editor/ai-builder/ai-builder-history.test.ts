import { describe, expect, it } from 'vitest'
import {
  appendAssistantTurn,
  appendUserTurn,
  EMPTY_AI_BUILDER_HISTORY,
  isRefinementTurn,
  latestAssistantRawJson,
  userRequestLog,
} from './ai-builder-history'

describe('ai-builder-history', () => {
  it('starts empty and reports no refinement', () => {
    expect(EMPTY_AI_BUILDER_HISTORY.turns).toEqual([])
    expect(isRefinementTurn(EMPTY_AI_BUILDER_HISTORY)).toBe(false)
    expect(latestAssistantRawJson(EMPTY_AI_BUILDER_HISTORY)).toBeNull()
    expect(userRequestLog(EMPTY_AI_BUILDER_HISTORY)).toEqual([])
  })

  it('appends user and assistant turns immutably', () => {
    const afterUser = appendUserTurn(EMPTY_AI_BUILDER_HISTORY, 'make a wallet')
    expect(EMPTY_AI_BUILDER_HISTORY.turns).toEqual([])
    expect(afterUser.turns).toHaveLength(1)
    expect(afterUser.turns[0]).toEqual({ role: 'user', request: 'make a wallet' })

    const afterAssistant = appendAssistantTurn(afterUser, '{"schema_version":1}')
    expect(afterUser.turns).toHaveLength(1)
    expect(afterAssistant.turns).toHaveLength(2)
    expect(afterAssistant.turns[1]).toEqual({ role: 'assistant', rawJson: '{"schema_version":1}' })
  })

  it('reports refinement only after an assistant turn exists', () => {
    const afterUser = appendUserTurn(EMPTY_AI_BUILDER_HISTORY, 'make a wallet')
    expect(isRefinementTurn(afterUser)).toBe(false)

    const afterAssistant = appendAssistantTurn(afterUser, '{"schema_version":1}')
    expect(isRefinementTurn(afterAssistant)).toBe(true)
  })

  it('returns the most recent assistant output regardless of trailing user turns', () => {
    const history = appendUserTurn(
      appendAssistantTurn(
        appendUserTurn(
          appendAssistantTurn(appendUserTurn(EMPTY_AI_BUILDER_HISTORY, 'first'), '{"first":true}'),
          'second',
        ),
        '{"second":true}',
      ),
      'third',
    )
    expect(latestAssistantRawJson(history)).toBe('{"second":true}')
    expect(userRequestLog(history)).toEqual(['first', 'second', 'third'])
  })
})
