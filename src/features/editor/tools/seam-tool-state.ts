/**
 * Seam-tool state machine, kept pure so both the 2D canvas and the 3D viewport
 * can drive the same in-progress selection. This mirrors the shape Seamer
 * Studio uses (`applySeamPick` / `advanceSeamToolPhase`): the tool holds picks,
 * not the views, so a seam can be started by clicking a flat edge and finished
 * by clicking the matching edge on the assembled model.
 */

export type SeamPick = {
  pieceId: string
  pieceName: string
  /** Index into the piece's sampled boundary polygon at pick time. */
  edgeIndex: number
  /** The authored boundary shape, which is what survives later edits. */
  boundaryShapeId?: string
  /**
   * Direction inferred from where along the edge the click landed: past the
   * midpoint means the user pointed at the far end, so the edge is walked
   * backwards. Guessing this beats defaulting to false and making the user
   * find a checkbox afterwards.
   */
  reversed: boolean
}

export type SeamToolKind = 'single' | 'multi'

export type SeamToolState = {
  from: SeamPick[]
  to: SeamPick[]
  /** Which side further picks land on. `multi` only; `single` fills implicitly. */
  phase: 'from' | 'to'
}

export const EMPTY_SEAM_TOOL_STATE: SeamToolState = { from: [], to: [], phase: 'from' }

export type SeamPickResult = {
  state: SeamToolState
  /** Set when the pick completes a seam. The caller commits it to the document. */
  commit?: { from: SeamPick[]; to: SeamPick[] }
  /** Status text for the user, when something worth saying happened. */
  message?: string
}

export function samePick(left: SeamPick, right: SeamPick) {
  return left.pieceId === right.pieceId && left.edgeIndex === right.edgeIndex
}

/** True when the pick already appears on either side of the in-progress seam. */
export function isPicked(state: SeamToolState, pick: SeamPick) {
  return state.from.some((entry) => samePick(entry, pick)) || state.to.some((entry) => samePick(entry, pick))
}

/**
 * Route one edge pick through the tool.
 *
 * Single: first pick is the `from` side, the second commits. Clicking the same
 * edge twice clears the selection.
 *
 * Multi: picks toggle within the active phase, so a run of edges can be built up
 * and corrected before advancing.
 */
export function applySeamPick(
  kind: SeamToolKind,
  state: SeamToolState,
  pick: SeamPick,
): SeamPickResult {
  if (kind === 'single') {
    if (state.from.length === 0) {
      return {
        state: { ...EMPTY_SEAM_TOOL_STATE, from: [pick] },
        message: `Seam start: ${pick.pieceName} edge ${pick.edgeIndex + 1}. Pick the matching edge.`,
      }
    }
    if (samePick(state.from[0], pick)) {
      return { state: EMPTY_SEAM_TOOL_STATE, message: 'Seam selection cleared' }
    }
    return {
      state: EMPTY_SEAM_TOOL_STATE,
      commit: { from: state.from, to: [pick] },
    }
  }

  if (state.phase === 'from') {
    const existing = state.from.findIndex((entry) => samePick(entry, pick))
    const from =
      existing >= 0 ? state.from.filter((_, index) => index !== existing) : [...state.from, pick]
    return {
      state: { ...state, from },
      message: `${from.length} edge(s) on the first side. Run "next" when done.`,
    }
  }

  if (state.from.some((entry) => samePick(entry, pick))) {
    return { state, message: 'That edge is already on the first side' }
  }
  const existing = state.to.findIndex((entry) => samePick(entry, pick))
  const to = existing >= 0 ? state.to.filter((_, index) => index !== existing) : [...state.to, pick]
  return {
    state: { ...state, to },
    message: `${to.length} edge(s) on the second side. Run "finish" to create the seam.`,
  }
}

/** `next` on the first side, `finish` on the second. */
export function advanceSeamToolPhase(state: SeamToolState): SeamPickResult {
  if (state.phase === 'from') {
    if (state.from.length === 0) {
      return { state, message: 'Pick at least one edge first' }
    }
    return {
      state: { ...state, phase: 'to' },
      message: 'Now picking the second side. Run "finish" when done.',
    }
  }
  if (state.from.length > 0 && state.to.length > 0) {
    return { state: EMPTY_SEAM_TOOL_STATE, commit: { from: state.from, to: state.to } }
  }
  return { state: EMPTY_SEAM_TOOL_STATE, message: 'Seam selection cleared' }
}

export function seamToolHint(kind: SeamToolKind, state: SeamToolState): string {
  if (kind === 'single') {
    return state.from.length === 0
      ? 'Seam: pick one piece edge, then the matching edge'
      : `Seam: pick the edge that joins ${state.from[0].pieceName} edge ${state.from[0].edgeIndex + 1}`
  }
  if (state.phase === 'from') {
    return `Seam (multi): picking the first side — ${state.from.length} edge(s). Run "next" to switch sides.`
  }
  return `Seam (multi): picking the second side — ${state.to.length} edge(s). Run "finish" to create the seam.`
}
