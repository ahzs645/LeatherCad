import { describe, expect, it } from 'vitest'
import {
  appendAssistantTurn,
  appendUserTurn,
  EMPTY_AI_BUILDER_HISTORY,
} from './ai-builder-history'
import { renderAiBuilderPrompt } from './ai-builder-prompt'
import { renderAiBuilderTurnPrompt } from './ai-builder-prompt-turn'
import { AI_BUILDER_ENTITY_TYPE_ORDER } from './ai-builder-schema'

const PRIOR_DOC = JSON.stringify(
  {
    schema_version: 1,
    document_name: 'bifold_wallet',
    units: 'mm',
    layers: [{ id: 'cut_layer', name: 'Cut' }],
    entities: [
      {
        id: 'shell',
        type: 'rectangle',
        layer_id: 'cut_layer',
        x: 0,
        y: 0,
        width: 200,
        height: 90,
      },
    ],
  },
  null,
  2,
)

describe('renderAiBuilderTurnPrompt', () => {
  it('matches the single-shot prompt on the first turn', () => {
    const request = 'Create a bifold wallet shell with a center fold.'
    const turnPrompt = renderAiBuilderTurnPrompt({ history: EMPTY_AI_BUILDER_HISTORY, request })
    const singleShot = renderAiBuilderPrompt(request)
    expect(turnPrompt).toBe(singleShot)
  })

  it('falls back to single-shot when only user turns are present', () => {
    const history = appendUserTurn(EMPTY_AI_BUILDER_HISTORY, 'make a wallet')
    const turnPrompt = renderAiBuilderTurnPrompt({ history, request: 'add a fold' })
    expect(turnPrompt).toBe(renderAiBuilderPrompt('add a fold'))
  })

  it('switches to refinement mode once an assistant turn exists', () => {
    const history = appendAssistantTurn(
      appendUserTurn(EMPTY_AI_BUILDER_HISTORY, 'create a bifold wallet shell'),
      PRIOR_DOC,
    )

    const prompt = renderAiBuilderTurnPrompt({
      history,
      request: 'add a card slot near the top edge',
    })

    expect(prompt).toContain('You are revising an existing LeatherCad AI Builder v1 document')
    expect(prompt).toContain('Output the FULL updated JSON document, not a partial diff or patch.')
    expect(prompt).toContain('Preserve entity ids that are unchanged from the previous document.')
    expect(prompt).toContain('Now generate the updated JSON for this LeatherCad refinement request:')
    expect(prompt).toContain('add a card slot near the top edge')
  })

  it('embeds the prior assistant document verbatim and the prior request log', () => {
    const history = appendAssistantTurn(
      appendUserTurn(EMPTY_AI_BUILDER_HISTORY, 'create a bifold wallet shell'),
      PRIOR_DOC,
    )

    const prompt = renderAiBuilderTurnPrompt({
      history,
      request: 'add a card slot',
    })

    expect(prompt).toContain('Current document (the JSON you returned previously):')
    expect(prompt).toContain(PRIOR_DOC)
    expect(prompt).toContain('User turn 1: create a bifold wallet shell')
  })

  it('still describes every supported entity type so the model can add new ones', () => {
    const history = appendAssistantTurn(
      appendUserTurn(EMPTY_AI_BUILDER_HISTORY, 'wallet'),
      PRIOR_DOC,
    )
    const prompt = renderAiBuilderTurnPrompt({ history, request: 'add a fold and a stitch line' })

    AI_BUILDER_ENTITY_TYPE_ORDER.forEach((entityType) => {
      expect(prompt).toContain(`Entity type "${entityType}"`)
    })
  })

  it('uses the most recent assistant document when several refinement turns exist', () => {
    const updatedDoc = PRIOR_DOC.replace('200', '210')
    const history = appendAssistantTurn(
      appendUserTurn(
        appendAssistantTurn(
          appendUserTurn(EMPTY_AI_BUILDER_HISTORY, 'create a wallet'),
          PRIOR_DOC,
        ),
        'make it 10mm wider',
      ),
      updatedDoc,
    )

    const prompt = renderAiBuilderTurnPrompt({ history, request: 'add a card slot' })
    expect(prompt).toContain(updatedDoc)
    // The earlier doc is no longer the "current document" - only the latest is
    // embedded under that heading. Conversation log should still include both
    // prior user turns.
    expect(prompt).toContain('User turn 1: create a wallet')
    expect(prompt).toContain('User turn 2: make it 10mm wider')
  })

  it('falls back to a default request when the user request is blank', () => {
    const history = appendAssistantTurn(
      appendUserTurn(EMPTY_AI_BUILDER_HISTORY, 'wallet'),
      PRIOR_DOC,
    )
    const prompt = renderAiBuilderTurnPrompt({ history, request: '   ' })
    expect(prompt).toContain('Create a simple leather pattern')
  })
})
