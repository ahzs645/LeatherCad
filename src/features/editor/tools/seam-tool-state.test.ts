import { describe, expect, it } from 'vitest'
import {
  advanceSeamToolPhase,
  applySeamPick,
  EMPTY_SEAM_TOOL_STATE,
  isPicked,
  seamToolHint,
  type SeamPick,
} from './seam-tool-state'

function pick(pieceId: string, edgeIndex: number, reversed = false): SeamPick {
  return { pieceId, pieceName: pieceId.toUpperCase(), edgeIndex, boundaryShapeId: `${pieceId}-${edgeIndex}`, reversed }
}

describe('single seam tool', () => {
  it('takes the first pick as the from side and commits on the second', () => {
    const first = applySeamPick('single', EMPTY_SEAM_TOOL_STATE, pick('front', 0))
    expect(first.commit).toBeUndefined()
    expect(first.state.from).toHaveLength(1)

    const second = applySeamPick('single', first.state, pick('back', 2))
    expect(second.commit).toEqual({ from: [pick('front', 0)], to: [pick('back', 2)] })
    expect(second.state).toEqual(EMPTY_SEAM_TOOL_STATE)
  })

  it('clears when the same edge is picked twice', () => {
    const first = applySeamPick('single', EMPTY_SEAM_TOOL_STATE, pick('front', 0))
    const again = applySeamPick('single', first.state, pick('front', 0))

    expect(again.commit).toBeUndefined()
    expect(again.state).toEqual(EMPTY_SEAM_TOOL_STATE)
  })

  it('treats a differently-oriented pick of the same edge as the same edge', () => {
    const first = applySeamPick('single', EMPTY_SEAM_TOOL_STATE, pick('front', 0, false))
    const again = applySeamPick('single', first.state, pick('front', 0, true))

    expect(again.state).toEqual(EMPTY_SEAM_TOOL_STATE)
  })
})

describe('multi seam tool', () => {
  it('accumulates picks on the active side and toggles a repeat off', () => {
    let state = EMPTY_SEAM_TOOL_STATE
    state = applySeamPick('multi', state, pick('gusset', 0)).state
    state = applySeamPick('multi', state, pick('gusset', 1)).state
    state = applySeamPick('multi', state, pick('gusset', 2)).state
    expect(state.from.map((entry) => entry.edgeIndex)).toEqual([0, 1, 2])

    state = applySeamPick('multi', state, pick('gusset', 1)).state
    expect(state.from.map((entry) => entry.edgeIndex)).toEqual([0, 2])
  })

  it('needs at least one pick before it will switch sides', () => {
    const blocked = advanceSeamToolPhase(EMPTY_SEAM_TOOL_STATE)

    expect(blocked.state.phase).toBe('from')
    expect(blocked.message).toContain('at least one edge')
  })

  it('switches sides, then commits both sides together', () => {
    let state = applySeamPick('multi', EMPTY_SEAM_TOOL_STATE, pick('gusset', 0)).state
    state = applySeamPick('multi', state, pick('gusset', 1)).state

    const advanced = advanceSeamToolPhase(state)
    expect(advanced.state.phase).toBe('to')
    state = advanced.state

    state = applySeamPick('multi', state, pick('front', 3)).state
    const finished = advanceSeamToolPhase(state)

    expect(finished.commit?.from.map((entry) => entry.edgeIndex)).toEqual([0, 1])
    expect(finished.commit?.to.map((entry) => entry.edgeIndex)).toEqual([3])
    expect(finished.state).toEqual(EMPTY_SEAM_TOOL_STATE)
  })

  it('refuses to put an edge on both sides of the same seam', () => {
    let state = applySeamPick('multi', EMPTY_SEAM_TOOL_STATE, pick('gusset', 0)).state
    state = advanceSeamToolPhase(state).state

    const rejected = applySeamPick('multi', state, pick('gusset', 0))

    expect(rejected.state.to).toEqual([])
    expect(rejected.message).toContain('already on the first side')
  })

  it('reports whether an edge is part of the in-progress seam', () => {
    const state = applySeamPick('multi', EMPTY_SEAM_TOOL_STATE, pick('gusset', 0)).state

    expect(isPicked(state, pick('gusset', 0))).toBe(true)
    expect(isPicked(state, pick('gusset', 4))).toBe(false)
  })
})

describe('seamToolHint', () => {
  it('names the edge waiting for a partner', () => {
    const state = applySeamPick('single', EMPTY_SEAM_TOOL_STATE, pick('front', 2)).state

    expect(seamToolHint('single', state)).toContain('FRONT edge 3')
  })

  it('says which side the multi tool is filling', () => {
    expect(seamToolHint('multi', EMPTY_SEAM_TOOL_STATE)).toContain('first side')
    expect(seamToolHint('multi', { ...EMPTY_SEAM_TOOL_STATE, phase: 'to' })).toContain('second side')
  })
})
