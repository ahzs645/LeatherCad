/**
 * Behaviours the wallet fixture cannot pin down, because it has none of them.
 */

import { describe, expect, it } from 'vitest'
import type { Point } from '../../cad/cad-types'
import { buildPatternDoc } from './pattern-doc-builder'
import { analyzePatternPaths } from './pattern-pdf-analysis'
import { detectOutlines } from '../outline-detection'
import { hydrateVectorPaths, type PdfPaint, type PdfPathSegment, type PdfVectorPath } from './pdf-vector-paths'

function closedPath(id: string, points: Point[], paint: PdfPaint = 'stroke'): PdfVectorPath {
  const segments: PdfPathSegment[] = points.map((point, index) => ({
    kind: 'line' as const,
    from: point,
    to: points[(index + 1) % points.length],
  }))
  return hydrateVectorPaths([
    {
      id,
      paint,
      strokeColor: '#000000',
      fillColor: paint === 'fill' ? '#000000' : null,
      subpaths: [{ segments, closed: true }],
    },
  ])[0]
}

function box(id: string, x: number, y: number, width: number, height: number, paint: PdfPaint = 'stroke') {
  return closedPath(
    id,
    [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    paint,
  )
}

const PAGE = { widthMm: 300, heightMm: 300 }

describe('buildPatternDoc', () => {
  it('cuts a card slot as real geometry on the piece it belongs to', () => {
    const analysis = analyzePatternPaths([box('panel', 0, 0, 100, 80), box('slot', 20, 20, 60, 12)], PAGE)

    const { doc } = buildPatternDoc(analysis)
    const [piece] = doc.patternPieces ?? []

    expect(piece.internalShapeIds).toHaveLength(4)
    // Closed, so the mesh builder can punch it through rather than draw a line.
    const chains = detectOutlines(doc.objects, doc.lineTypes)
    const slotChain = chains.find((chain) => chain.shapeIds.includes(piece.internalShapeIds[0]))
    expect(slotChain?.isClosed).toBe(true)
    expect(slotChain?.shapeIds).toEqual(piece.internalShapeIds)
  })

  it('centres the pattern on the origin without changing its size', () => {
    const analysis = analyzePatternPaths([box('panel', 500, 400, 100, 80)], PAGE)

    const { doc } = buildPatternDoc(analysis)
    const xs = doc.objects.flatMap((shape) =>
      shape.type === 'text' ? [] : [shape.start.x, shape.end.x],
    )

    expect(Math.min(...xs)).toBeCloseTo(-50, 6)
    expect(Math.max(...xs)).toBeCloseTo(50, 6)
  })

  it('leaves the pattern where it was drawn when asked to', () => {
    const analysis = analyzePatternPaths([box('panel', 500, 400, 100, 80)], PAGE)

    const { doc } = buildPatternDoc(analysis, { centreOnOrigin: false })
    const xs = doc.objects.flatMap((shape) =>
      shape.type === 'text' ? [] : [shape.start.x, shape.end.x],
    )

    expect(Math.min(...xs)).toBeCloseTo(500, 6)
  })

  it('skips fold inference when told to', () => {
    const holes = [
      ...Array.from({ length: 12 }, (_, i) => box(`l-${i}`, 3.4, 59.4 + i * 5, 1.2, 1.2, 'fill')),
      ...Array.from({ length: 18 }, (_, i) => box(`b-${i}`, 8.4 + i * 5, 115.4, 1.2, 1.2, 'fill')),
      ...Array.from({ length: 12 }, (_, i) => box(`r-${i}`, 95.4, 114.4 - i * 5, 1.2, 1.2, 'fill')),
    ]
    const analysis = analyzePatternPaths([box('panel', 0, 0, 100, 120), ...holes], PAGE)

    expect(buildPatternDoc(analysis).doc.foldLines.length).toBeGreaterThan(0)
    expect(buildPatternDoc(analysis, { inferFoldLines: false }).doc.foldLines).toEqual([])
  })

  it('reports a piece it could not build a boundary for rather than dropping it', () => {
    const analysis = analyzePatternPaths([box('panel', 0, 0, 100, 80)], PAGE)
    analysis.pieces[0] = { ...analysis.pieces[0], sides: [] }

    const { doc, warnings } = buildPatternDoc(analysis)

    expect(doc.patternPieces).toHaveLength(0)
    expect(warnings[0]).toContain('outline produced no shapes')
  })
})
