import { describe, expect, it } from 'vitest'
import type { Shape } from '../cad/cad-types'
import {
  clearSelectedBoxStitchSources,
  extractBoxStitchGuideLines,
  markSelectedShapesAsBoxStitchSource,
} from './box-stitch-ops'

function line(
  id: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  extracted = false,
): Shape {
  return {
    id,
    type: 'line',
    layerId: 'layer-1',
    lineTypeId: 'cut',
    ...(extracted ? { boxStitchSource: { extracted: true as const } } : {}),
    start,
    end,
  }
}

function arc(
  id: string,
  start: { x: number; y: number },
  mid: { x: number; y: number },
  end: { x: number; y: number },
): Shape {
  return {
    id,
    type: 'arc',
    layerId: 'layer-1',
    lineTypeId: 'cut',
    start,
    mid,
    end,
  }
}

describe('extractBoxStitchGuideLines', () => {
  it('pairs opposite candidate edges and projects guides inside the selection bounds', () => {
    const boundaryShapes = [
      line('top', { x: 10, y: 0 }, { x: 90, y: 0 }),
      line('bottom', { x: 20, y: 40 }, { x: 80, y: 40 }),
      line('left', { x: 0, y: 5 }, { x: 0, y: 35 }),
      line('right', { x: 100, y: 8 }, { x: 100, y: 30 }),
    ]

    const result = extractBoxStitchGuideLines(boundaryShapes, 6, 'layer-1', 'stitch')

    expect(result.extractedEdgeCount).toBe(4)
    expect(result.usedFallback).toBe(false)
    expect(result.guideLines).toHaveLength(4)
    expect(result.guideLines[0]?.start).toEqual({ x: 20, y: 6 })
    expect(result.guideLines[0]?.end).toEqual({ x: 80, y: 6 })
    expect(result.guideLines[1]?.start).toEqual({ x: 94, y: 8 })
    expect(result.guideLines[1]?.end).toEqual({ x: 94, y: 30 })
  })

  it('falls back to bounds-based guides when opposite candidates are missing', () => {
    const boundaryShapes = [
      line('top', { x: 0, y: 0 }, { x: 100, y: 0 }),
      line('bottom', { x: 0, y: 40 }, { x: 100, y: 40 }),
    ]

    const result = extractBoxStitchGuideLines(boundaryShapes, 5, 'layer-1', 'stitch')

    expect(result.extractedEdgeCount).toBe(2)
    expect(result.usedFallback).toBe(true)
    expect(result.guideLines).toHaveLength(4)
    expect(result.guideLines[2]?.start).toEqual({ x: 5, y: 35 })
    expect(result.guideLines[3]?.end).toEqual({ x: 5, y: 5 })
  })

  it('applies stretch compensation to paired overlap ranges', () => {
    const boundaryShapes = [
      line('top', { x: 25, y: 0 }, { x: 75, y: 0 }),
      line('bottom', { x: 25, y: 40 }, { x: 75, y: 40 }),
      line('left', { x: 0, y: 10 }, { x: 0, y: 30 }),
      line('right', { x: 100, y: 10 }, { x: 100, y: 30 }),
    ]

    const uncompensated = extractBoxStitchGuideLines(
      boundaryShapes,
      { distanceMm: 5, stretchCompensationPercent: 100 },
      'layer-1',
      'stitch',
    )
    const compensated = extractBoxStitchGuideLines(
      boundaryShapes,
      { distanceMm: 5, stretchCompensationPercent: 150 },
      'layer-1',
      'stitch',
    )

    expect(uncompensated.guideLines[0]?.start.x).toBe(25)
    expect(uncompensated.guideLines[0]?.end.x).toBe(75)
    expect(compensated.guideLines[0]?.start.x).toBe(12.5)
    expect(compensated.guideLines[0]?.end.x).toBe(87.5)
  })

  it('projects sampled guide segments when opposite candidates are curved', () => {
    const boundaryShapes = [
      arc('top', { x: 10, y: 6 }, { x: 50, y: 0 }, { x: 90, y: 6 }),
      arc('bottom', { x: 15, y: 34 }, { x: 50, y: 40 }, { x: 85, y: 34 }),
      line('left', { x: 0, y: 8 }, { x: 0, y: 32 }),
      line('right', { x: 100, y: 8 }, { x: 100, y: 32 }),
    ]

    const result = extractBoxStitchGuideLines(boundaryShapes, 6, 'layer-1', 'stitch')

    expect(result.extractedEdgeCount).toBe(4)
    expect(result.usedFallback).toBe(false)
    expect(result.guideLines.some((guide) => Math.abs(guide.start.y - guide.end.y) > 0.2)).toBe(true)
    expect(Math.min(...result.guideGroups[0].points.map((point) => point.y))).toBeGreaterThanOrEqual(6)
    expect(Math.max(...result.guideGroups[2].points.map((point) => point.y))).toBeLessThanOrEqual(34)
  })
})

describe('box stitch source extraction', () => {
  it('marks and clears extracted box stitch source metadata without changing geometry', () => {
    const shapes = [
      line('line-1', { x: 0, y: 0 }, { x: 40, y: 0 }),
      arc('arc-1', { x: 0, y: 10 }, { x: 20, y: 5 }, { x: 40, y: 10 }),
      {
        id: 'text-1',
        type: 'text',
        layerId: 'layer-1',
        lineTypeId: 'cut',
        start: { x: 0, y: 20 },
        end: { x: 20, y: 20 },
        text: 'A',
        fontFamily: 'Inter',
        fontSizeMm: 4,
        transform: 'none' as const,
        radiusMm: 0,
        sweepDeg: 0,
      } satisfies Shape,
    ]

    const marked = markSelectedShapesAsBoxStitchSource(shapes, new Set(['line-1', 'arc-1', 'text-1']))
    expect(marked.updatedCount).toBe(2)
    expect(marked.nextShapes[0]).toMatchObject({
      id: 'line-1',
      boxStitchSource: { extracted: true },
      start: { x: 0, y: 0 },
      end: { x: 40, y: 0 },
    })
    expect(marked.nextShapes[1]).toMatchObject({
      id: 'arc-1',
      boxStitchSource: { extracted: true },
      start: { x: 0, y: 10 },
      end: { x: 40, y: 10 },
    })
    expect(marked.nextShapes[2]).not.toHaveProperty('boxStitchSource')

    const cleared = clearSelectedBoxStitchSources(marked.nextShapes, new Set(['line-1', 'arc-1']))
    expect(cleared.updatedCount).toBe(2)
    expect(cleared.nextShapes[0]).not.toHaveProperty('boxStitchSource')
    expect(cleared.nextShapes[1]).not.toHaveProperty('boxStitchSource')
  })
})
