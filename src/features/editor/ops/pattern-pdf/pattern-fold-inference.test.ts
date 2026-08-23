import { describe, expect, it } from 'vitest'
import { analyzePatternPaths } from './pattern-pdf-analysis'
import { inferFoldLines } from './pattern-fold-inference'
import { hydrateVectorPaths, type PdfPaint, type PdfPathSegment, type PdfVectorPath } from './pdf-vector-paths'
import type { Point } from '../../cad/cad-types'

function closedPath(id: string, points: Point[], paint: PdfPaint = 'stroke'): PdfVectorPath {
  const segments: PdfPathSegment[] = points.map((point, index) => ({
    kind: 'line' as const,
    from: point,
    to: points[(index + 1) % points.length],
  }))
  return hydrateVectorPaths([
    { id, paint, strokeColor: '#000000', fillColor: paint === 'fill' ? '#000000' : null, subpaths: [{ segments, closed: true }] },
  ])[0]
}

function disc(id: string, centre: Point, diameterMm = 1.2) {
  const radius = diameterMm / 2
  return closedPath(
    id,
    Array.from({ length: 20 }, (_, index) => {
      const angle = (index / 20) * Math.PI * 2
      return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius }
    }),
    'fill',
  )
}

const PAGE = { widthMm: 300, heightMm: 300 }

describe('inferFoldLines', () => {
  it('hinges a flap across the open ends of the seam below it', () => {
    // A 100 × 120 panel sewn in a U from y = 60 down, leaving half of it free.
    const holes = [
      ...Array.from({ length: 12 }, (_, i) => disc(`left-${i}`, { x: 4, y: 60 + i * 5 })),
      ...Array.from({ length: 18 }, (_, i) => disc(`bottom-${i}`, { x: 4 + (i + 1) * 5, y: 116 })),
      ...Array.from({ length: 12 }, (_, i) => disc(`right-${i}`, { x: 96, y: 115 - i * 5 })),
    ]
    const panel = closedPath('panel', [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 120 },
      { x: 0, y: 120 },
    ])

    const folds = inferFoldLines(analyzePatternPaths([panel, ...holes], PAGE))

    expect(folds).toHaveLength(1)
    expect(folds[0].evidence).toBe('flap')
    expect(folds[0].fold.start.y).toBeCloseTo(60, 0)
    expect(folds[0].fold.end.y).toBeCloseTo(60, 0)
  })

  it('leaves a pocket alone when the run ends only clear its seam allowance', () => {
    // Same U, but the piece stops 4 mm past the stitching: no flap, no fold.
    const holes = [
      ...Array.from({ length: 12 }, (_, i) => disc(`left-${i}`, { x: 4, y: 4 + i * 5 })),
      ...Array.from({ length: 18 }, (_, i) => disc(`bottom-${i}`, { x: 4 + (i + 1) * 5, y: 60 })),
      ...Array.from({ length: 12 }, (_, i) => disc(`right-${i}`, { x: 96, y: 59 - i * 5 })),
    ]
    const pocket = closedPath('pocket', [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 64 },
      { x: 0, y: 64 },
    ])

    expect(inferFoldLines(analyzePatternPaths([pocket, ...holes], PAGE))).toHaveLength(0)
  })

  it('folds a tab down the axis its two matching runs meet across', () => {
    const tab = closedPath('tab', [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 30 },
      { x: 0, y: 30 },
    ])
    const holes = [
      ...Array.from({ length: 4 }, (_, i) => disc(`a-${i}`, { x: 6, y: 6 + i * 5 })),
      ...Array.from({ length: 4 }, (_, i) => disc(`b-${i}`, { x: 34, y: 6 + i * 5 })),
    ]

    const folds = inferFoldLines(analyzePatternPaths([tab, ...holes], PAGE))

    expect(folds).toHaveLength(1)
    expect(folds[0].evidence).toBe('mirror')
    expect(folds[0].fold.start.x).toBeCloseTo(20, 3)
    expect(folds[0].fold.end.x).toBeCloseTo(20, 3)
  })
})
