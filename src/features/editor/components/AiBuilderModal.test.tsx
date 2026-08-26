/**
 * The repair loop: what the app already knows goes back to the agent.
 *
 * Compile and preflight run in the browser on every snapshot the agent sends,
 * so by the time a turn finishes the app is holding a list of exactly what is
 * wrong with the document that just arrived. Before this it showed that list to
 * whoever was watching and stopped. These tests pin that it is handed back
 * instead, and that it stops being handed back once it stops helping.
 */

import { act, createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupRender, click, renderForTest } from '../../../test/render'
import { AiBuilderModal } from './AiBuilderModal'
import type { AiAgentEvent, AiAgentTurnInput } from '../ai-builder/ai-agent-client'

const turns: AiAgentTurnInput[] = []

vi.mock('../ai-builder/ai-agent-client', async () => {
  const actual = await vi.importActual<typeof import('../ai-builder/ai-agent-client')>(
    '../ai-builder/ai-agent-client',
  )
  return {
    ...actual,
    getAiAgentStatus: async () => ({
      available: true,
      mode: 'openai' as const,
      model: 'test-model',
      livePreview: true,
    }),
    startAiAgentTurn: (input: AiAgentTurnInput) => {
      turns.push(input)
      return { stop: () => undefined }
    },
  }
})

/** A document that parses and compiles but leaves preflight errors behind. */
const BROKEN = JSON.stringify({
  schema_version: 1,
  units: 'mm',
  document_name: 'broken',
  layers: [{ id: 'main', name: 'Main' }],
  entities: [
    { id: 'just_a_label', type: 'text', layer_id: 'main', position: { x: 0, y: 0 }, value: 'nothing to cut' },
  ],
})

function emit(event: AiAgentEvent) {
  act(() => {
    turns[turns.length - 1]?.onEvent(event)
  })
}

function snapshot(rawJson: string) {
  emit({
    type: 'template.snapshot',
    turnId: 't',
    label: 'final',
    stage: 1,
    final: true,
    rawJson,
    createdAt: '2026-08-26T00:00:00.000Z',
  })
}

describe('AiBuilderModal repair loop', () => {
  let rendered: ReturnType<typeof renderForTest> | null = null

  afterEach(() => {
    cleanupRender(rendered)
    rendered = null
    turns.length = 0
  })

  async function open() {
    rendered = renderForTest(
      createElement(AiBuilderModal, {
        open: true,
        onClose: () => undefined,
        onLoadDocument: () => undefined,
        onInsertDocument: () => undefined,
        onSetStatus: () => undefined,
      }),
    )
    // The Run button stays disabled until the agent status resolves.
    await act(async () => {
      await Promise.resolve()
    })
    const run = [...rendered.container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Run Live',
    )
    click(run ?? null)
    return rendered
  }

  it('hands the agent its own preflight errors and asks again', async () => {
    await open()
    expect(turns).toHaveLength(1)
    // A first turn carries no findings, because there are none yet.
    expect(turns[0].preflightIssues).toBeUndefined()

    snapshot(BROKEN)
    emit({ type: 'turn.completed', turnId: 't', createdAt: '2026-08-26T00:00:00.000Z' })

    expect(turns).toHaveLength(2)
    const repair = turns[1]
    expect(repair.preflightIssues?.length ?? 0).toBeGreaterThan(0)
    // It is the app's own wording, not a restatement: the codes have to survive
    // so the model is told which rule it broke.
    expect(repair.preflightIssues?.join(' ')).toMatch(/no-pattern-pieces|missing-cut-lines/)
    // And the failing document goes with them, so the fix is an edit rather
    // than a fresh guess.
    expect(repair.currentJson).toContain('"document_name":"broken"')
    expect(repair.request).toBe(turns[0].request)
  })

  it('stops after two repair passes rather than looping on a document it cannot fix', async () => {
    await open()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      snapshot(BROKEN)
      emit({ type: 'turn.completed', turnId: 't', createdAt: '2026-08-26T00:00:00.000Z' })
    }
    // One original turn plus two repairs, and then it gives up: each pass costs
    // a whole generation, and a model that has failed twice is not converging.
    expect(turns).toHaveLength(3)
  })

  it('does not repair a document the app is happy with', async () => {
    await open()
    snapshot(
      JSON.stringify({
        schema_version: 1,
        units: 'mm',
        document_name: 'fine',
        layers: [{ id: 'main', name: 'Main' }],
        entities: [
          {
            id: 'panel_outline',
            type: 'rectangle',
            layer_id: 'main',
            x: 0,
            y: 0,
            width: 80,
            height: 60,
            line_role: 'cut',
          },
          {
            id: 'panel_piece',
            type: 'pattern_piece',
            layer_id: 'main',
            boundary_entity_id: 'panel_outline',
            name: 'Panel',
            quantity: 1,
          },
          {
            id: 'panel_stitch',
            type: 'stitch_path',
            layer_id: 'main',
            path_type: 'line',
            start: { x: 5, y: 55 },
            end: { x: 75, y: 55 },
            pitch_mm: 4,
          },
        ],
      }),
    )
    emit({ type: 'turn.completed', turnId: 't', createdAt: '2026-08-26T00:00:00.000Z' })
    expect(turns).toHaveLength(1)
  })
})
