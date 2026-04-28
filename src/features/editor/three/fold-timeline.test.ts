import { describe, expect, it } from 'vitest'
import type { FoldLine } from '../cad/cad-types'
import {
  buildFoldTimelinePreview,
  compileFoldTimeline,
  foldLinesAtTimelineProgress,
  validateFoldTimeline,
  type FoldInstructionNode,
} from './fold-timeline'

function foldLine(id: string, angleDeg = 90): FoldLine {
  return {
    id,
    name: id,
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    angleDeg,
    maxAngleDeg: 180,
    direction: 'mountain',
  }
}

describe('fold timeline', () => {
  it('compiles default per-hinge steps from fold lines', () => {
    const timeline = compileFoldTimeline({
      foldLines: [foldLine('left'), foldLine('right')],
    })

    expect(timeline).toHaveLength(2)
    expect(timeline[0].commands[0].foldLineId).toBe('left')
    expect(timeline[0].start).toBe(0)
    expect(timeline[1].end).toBe(1)
  })

  it('applies staggered progress across fold steps', () => {
    const folds = [foldLine('left', 90), foldLine('right', 60)]
    const timeline = compileFoldTimeline({ foldLines: folds })

    const early = foldLinesAtTimelineProgress(folds, timeline, 0.25)
    expect(early.find((fold) => fold.id === 'left')?.angleDeg).toBeCloseTo(45)
    expect(early.find((fold) => fold.id === 'right')?.angleDeg).toBeCloseTo(0)

    const late = foldLinesAtTimelineProgress(folds, timeline, 0.75)
    expect(late.find((fold) => fold.id === 'left')?.angleDeg).toBeCloseTo(90)
    expect(late.find((fold) => fold.id === 'right')?.angleDeg).toBeCloseTo(30)
  })

  it('flattens hierarchical instruction nodes into timeline steps', () => {
    const instructions: FoldInstructionNode[] = [{
      id: 'wallet-review',
      label: 'Wallet review',
      children: [
        { id: 'open-shell', commands: [{ foldLineId: 'center', targetAngleDeg: 45, duration: 2 }] },
        { id: 'close-shell', commands: [{ foldLineId: 'center', targetAngleDeg: 120 }] },
      ],
    }]

    const timeline = compileFoldTimeline({
      foldLines: [foldLine('center', 120)],
      instructions,
    })

    expect(timeline).toHaveLength(2)
    expect(timeline[0].end).toBeCloseTo(2 / 3)
    expect(timeline[1].commands[0].targetAngleDeg).toBe(120)
  })

  it('validates missing fold-line references', () => {
    const timeline = compileFoldTimeline({
      foldLines: [foldLine('known')],
      instructions: [{ id: 'bad-step', commands: [{ foldLineId: 'missing' }] }],
    })

    expect(validateFoldTimeline(timeline, [foldLine('known')]).some((diagnostic) => diagnostic.code === 'fold-timeline-missing-fold')).toBe(true)
  })

  it('returns preview fold lines and diagnostics together', () => {
    const preview = buildFoldTimelinePreview({
      foldLines: [foldLine('known')],
      instructions: [{ id: 'step', commands: [{ foldLineId: 'known', targetAngleDeg: 30 }] }],
      progress: 1,
    })

    expect(preview.foldLines[0].angleDeg).toBeCloseTo(30)
    expect(preview.diagnostics).toHaveLength(0)
  })
})
