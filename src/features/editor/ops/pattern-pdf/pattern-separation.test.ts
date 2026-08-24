import { describe, expect, it } from 'vitest'
import type { Point } from '../../cad/cad-types'
import { separatePatternPaths } from './pattern-separation'
import { hydrateVectorPaths, type PdfPaint, type PdfPathSegment, type PdfVectorPath } from './pdf-vector-paths'

function polygonPath(id: string, points: Point[], paint: PdfPaint = 'stroke'): PdfVectorPath {
  const segments: PdfPathSegment[] = points.map((point, index) => ({
    kind: 'line' as const,
    from: point,
    to: points[(index + 1) % points.length],
  }))
  return hydrateVectorPaths([
    { id, paint, strokeColor: paint === 'fill' ? null : '#000000', fillColor: paint === 'stroke' ? null : '#000000', subpaths: [{ segments, closed: true }] },
  ])[0]
}

function rectangle(id: string, x: number, y: number, width: number, height: number, paint: PdfPaint = 'stroke') {
  return polygonPath(id, [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ], paint)
}

/** A filled disc, the way a template draws a punch mark. */
function disc(id: string, centre: Point, diameterMm: number, paint: PdfPaint = 'fill') {
  const radius = diameterMm / 2
  const points = Array.from({ length: 24 }, (_, index) => {
    const angle = (index / 24) * Math.PI * 2
    return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius }
  })
  return polygonPath(id, points, paint)
}

describe('separatePatternPaths', () => {
  it('reads a large closed path as a piece and a small round one as a punch mark', () => {
    const result = separatePatternPaths([
      rectangle('panel', 0, 0, 80, 60),
      disc('hole', { x: 10, y: 10 }, 1.2),
    ])

    expect(result.pieces).toHaveLength(1)
    expect(result.pieces[0].id).toBe('panel')
    expect(result.pieces[0].dots).toHaveLength(1)
    expect(result.pieces[0].dots[0].diameterMm).toBeCloseTo(1.2, 1)
  })

  it('reads a closed path inside a piece as a cutout, not another piece', () => {
    const result = separatePatternPaths([
      rectangle('panel', 0, 0, 80, 60),
      rectangle('card-slot', 20, 20, 40, 20),
    ])

    expect(result.pieces).toHaveLength(1)
    expect(result.pieces[0].cutouts.map((cutout) => cutout.id)).toEqual(['card-slot'])
  })

  it('leaves a mark that sits over a cutout off the piece', () => {
    const result = separatePatternPaths([
      rectangle('panel', 0, 0, 80, 60),
      rectangle('window', 20, 20, 40, 20),
      disc('over-window', { x: 40, y: 30 }, 1.2),
    ])

    expect(result.pieces[0].dots).toHaveLength(0)
    expect(result.strayDots.map((dot) => dot.id)).toEqual(['over-window'])
  })

  it('rejects a punch-sized sliver that is nowhere near round', () => {
    const result = separatePatternPaths([
      rectangle('panel', 0, 0, 80, 60),
      rectangle('sliver', 10, 10, 6, 0.6),
    ])

    expect(result.pieces[0].dots).toHaveLength(0)
    expect(result.ignored.find((entry) => entry.id === 'sliver')?.reason).toBe('not-round')
  })

  it('rejects a closed path too big to be a punch and too small to be a piece', () => {
    const result = separatePatternPaths([
      rectangle('panel', 0, 0, 80, 60),
      disc('coaster', { x: 40, y: 30 }, 15),
    ])

    expect(result.pieces[0].dots).toHaveLength(0)
    expect(result.ignored.find((entry) => entry.id === 'coaster')?.reason).toBe('too-small')
  })

  it('keeps an unpainted clip frame and open artwork out of the pieces', () => {
    const clip = { ...rectangle('clip', -5, -5, 300, 300), paint: 'none' as const }
    const strokeMark = hydrateVectorPaths([
      {
        id: 'callout',
        paint: 'stroke',
        strokeColor: '#000000',
        fillColor: null,
        subpaths: [{ segments: [{ kind: 'line', from: { x: 5, y: 5 }, to: { x: 40, y: 5 } }], closed: false }],
      },
    ])[0]

    const result = separatePatternPaths([clip, rectangle('panel', 0, 0, 80, 60), strokeMark])

    expect(result.pieces.map((piece) => piece.id)).toEqual(['panel'])
    expect(result.ignored.find((entry) => entry.id === 'clip')?.reason).toBe('unpainted')
    expect(result.ignored.find((entry) => entry.id === 'callout')?.reason).toBe('open-path')
  })

  it('orders pieces largest first', () => {
    const result = separatePatternPaths([
      rectangle('small', 200, 0, 30, 30),
      rectangle('large', 0, 0, 120, 90),
      rectangle('medium', 0, 200, 60, 60),
    ])

    expect(result.pieces.map((piece) => piece.id)).toEqual(['large', 'medium', 'small'])
  })
})
