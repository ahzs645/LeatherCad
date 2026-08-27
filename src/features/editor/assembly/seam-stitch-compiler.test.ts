import { describe, expect, it } from 'vitest'
import type { PieceMeshData } from '../three/piece-mesh'
import { compileExplicitSeams } from './seam-stitch-compiler'
import { buildSeamAssemblyDiagnostics } from './assembly-diagnostics'

function piece(pieceId: string, name: string, width: number, y = 0): PieceMeshData {
  const outer = [
    { x: 0, y },
    { x: width, y },
    { x: width, y: y + 10 },
    { x: 0, y: y + 10 },
  ]
  return {
    pieceId,
    name,
    outer,
    holes: [],
    shapeSegments: [
      { shapeId: `${pieceId}-bottom`, firstEdgeIndex: 0, lastEdgeIndex: 0 },
      { shapeId: `${pieceId}-right`, firstEdgeIndex: 1, lastEdgeIndex: 1 },
      { shapeId: `${pieceId}-top`, firstEdgeIndex: 2, lastEdgeIndex: 2 },
      { shapeId: `${pieceId}-left`, firstEdgeIndex: 3, lastEdgeIndex: 3 },
    ],
    bounds: { minX: 0, minY: y, maxX: width, maxY: y + 10, width, height: 10 },
    center: { x: width / 2, y: y + 5 },
    edges: [
      { index: 0, start: outer[0], end: outer[1], midpoint: { x: width / 2, y }, lengthMm: width },
      { index: 1, start: outer[1], end: outer[2], midpoint: { x: width, y: y + 5 }, lengthMm: 10 },
      { index: 2, start: outer[2], end: outer[3], midpoint: { x: width / 2, y: y + 10 }, lengthMm: width },
      { index: 3, start: outer[3], end: outer[0], midpoint: { x: 0, y: y + 5 }, lengthMm: 10 },
    ],
  }
}

describe('explicit seam compiler', () => {
  it('compiles edge seam connections into paired stitch chains', () => {
    const compiled = compileExplicitSeams({
      pieceMeshes: [piece('front', 'Front', 40), piece('back', 'Back', 40, 20)],
      seamConnections: [{
        id: 'seam-1',
        from: { pieceId: 'front', edgeIndex: 0 },
        to: { pieceId: 'back', edgeIndex: 2 },
        kind: 'sewn',
        stitchSpacingMm: 10,
        reversed: true,
      }],
    })

    expect(compiled.chains).toHaveLength(2)
    expect(compiled.pairs).toHaveLength(1)
    expect(compiled.pairs[0].left.pointCount).toBe(5)
    expect(compiled.pairs[0].left.holes[0].pairedHoleId).toBe(compiled.pairs[0].right.holes[0].id)
  })

  it('reports length mismatch and duplicate sewn edges as diagnostics', () => {
    const diagnostics = buildSeamAssemblyDiagnostics({
      patternPieces: [
        { id: 'front', name: 'Front' } as never,
        { id: 'back', name: 'Back' } as never,
      ],
      pieceMeshes: [piece('front', 'Front', 40), piece('back', 'Back', 20, 20)],
      seamConnections: [
        {
          id: 'seam-1',
          from: { pieceId: 'front', edgeIndex: 0 },
          to: { pieceId: 'back', edgeIndex: 0 },
          kind: 'sewn',
        },
        {
          id: 'seam-2',
          from: { pieceId: 'front', edgeIndex: 0 },
          to: { pieceId: 'back', edgeIndex: 2 },
          kind: 'sewn',
        },
      ],
      lengthToleranceMm: 1,
    })

    expect(diagnostics.map((entry) => entry.code)).toContain('seam.length_mismatch')
    expect(diagnostics.map((entry) => entry.code)).toContain('seam.duplicate_connection')
  })
})


describe('multi-span and curved seam sides', () => {
  /** A panel whose right side is a curve sampled into eight chords. */
  function curvedPiece(pieceId: string, y = 0): PieceMeshData {
    const curve = Array.from({ length: 9 }, (_, index) => ({ x: 40, y: y + index * 2.5 }))
    const outer = [{ x: 0, y }, ...curve, { x: 0, y: y + 20 }]
    const edges = [
      { index: 0, start: outer[0], end: curve[0], midpoint: { x: 20, y }, lengthMm: 40 },
      ...curve.slice(0, -1).map((point, index) => ({
        index: index + 1,
        start: point,
        end: curve[index + 1],
        midpoint: { x: 40, y: point.y + 1.25 },
        lengthMm: 2.5,
      })),
      { index: 9, start: curve[curve.length - 1], end: outer[outer.length - 1], midpoint: { x: 20, y: y + 20 }, lengthMm: 40 },
    ]
    return {
      pieceId,
      name: pieceId,
      outer,
      holes: [],
      shapeSegments: [
        { shapeId: `${pieceId}-bottom`, firstEdgeIndex: 0, lastEdgeIndex: 0 },
        { shapeId: `${pieceId}-curve`, firstEdgeIndex: 1, lastEdgeIndex: 8 },
        { shapeId: `${pieceId}-top`, firstEdgeIndex: 9, lastEdgeIndex: 9 },
      ],
      bounds: { minX: 0, minY: y, maxX: 40, maxY: y + 20, width: 40, height: 20 },
      center: { x: 20, y: y + 10 },
      edges,
    }
  }

  it('runs a seam along a whole curved side, not one sampled chord', () => {
    const compiled = compileExplicitSeams({
      pieceMeshes: [curvedPiece('front'), curvedPiece('back', 40)],
      seamConnections: [{
        id: 'seam-curve',
        from: { pieceId: 'front', edgeIndex: 1, boundaryShapeId: 'front-curve' },
        to: { pieceId: 'back', edgeIndex: 1, boundaryShapeId: 'back-curve' },
        kind: 'sewn',
        stitchSpacingMm: 5,
      }],
    })

    // Eight 2.5mm chords make a 20mm side, so the chain spans the curve rather
    // than the 2.5mm chord the raw edgeIndex names.
    expect(compiled.chains[0].lengthMm).toBeCloseTo(20, 5)
    expect(compiled.chains[0].holes.length).toBeGreaterThan(2)
    const ys = compiled.chains[0].holes.map((hole) => hole.point.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(20, 5)
  })

  it('treats several boundary shapes as one seam with continuous stitch numbering', () => {
    const compiled = compileExplicitSeams({
      pieceMeshes: [piece('gusset', 'Gusset', 40), piece('front', 'Front', 40, 20)],
      seamConnections: [{
        id: 'seam-multi',
        from: { pieceId: 'gusset', edgeIndex: 0 },
        to: { pieceId: 'front', edgeIndex: 2 },
        fromSpans: [
          { pieceId: 'gusset', edgeIndex: 0, t0: 0, t1: 1 },
          { pieceId: 'gusset', edgeIndex: 1, t0: 0, t1: 1 },
        ],
        toSpans: [{ pieceId: 'front', edgeIndex: 2, t0: 0, t1: 1 }],
        kind: 'sewn',
        stitchSpacingMm: 10,
      }],
    })

    expect(compiled.pairs).toHaveLength(1)
    // 40mm bottom + 10mm right on one side against a 40mm side on the other.
    expect(compiled.chains[0].lengthMm).toBeCloseTo(50, 5)
    expect(compiled.chains[1].lengthMm).toBeCloseTo(40, 5)
    expect(compiled.pairs[0].rmsErrorMm).toBeCloseTo(10, 5)
    // Both sides carry the same stitch count so every hole has a partner.
    expect(compiled.chains[0].holes).toHaveLength(compiled.chains[1].holes.length)
    compiled.chains[0].holes.forEach((hole, index) => {
      expect(hole.pairedHoleId).toBe(compiled.chains[1].holes[index].id)
    })
  })

  it('honours a partial span across the side, not per sampled chord', () => {
    const compiled = compileExplicitSeams({
      pieceMeshes: [curvedPiece('front'), curvedPiece('back', 40)],
      seamConnections: [{
        id: 'seam-partial',
        from: { pieceId: 'front', edgeIndex: 1, boundaryShapeId: 'front-curve' },
        to: { pieceId: 'back', edgeIndex: 1, boundaryShapeId: 'back-curve' },
        fromSpans: [{ pieceId: 'front', edgeIndex: 1, boundaryShapeId: 'front-curve', t0: 0.5, t1: 1 }],
        toSpans: [{ pieceId: 'back', edgeIndex: 1, boundaryShapeId: 'back-curve', t0: 0.5, t1: 1 }],
        kind: 'sewn',
        stitchSpacingMm: 5,
      }],
    })

    expect(compiled.chains[0].lengthMm).toBeCloseTo(10, 5)
    const ys = compiled.chains[0].holes.map((hole) => hole.point.y)
    expect(Math.min(...ys)).toBeCloseTo(10, 5)
  })
})

describe('seam direction lives on the connection, not on the spans', () => {
  // A fold-over closure: one side of one piece sewn to itself, the way the snap
  // coin pouch closes. Edge 3 of `piece()` runs (0,10) -> (0,0), so t=0.5 is the
  // fold and t=0 / t=1 are the two corners. Sewn head to tail the fold meets
  // itself and the corners meet each other; sewn head to head a corner is pulled
  // onto the fold and the seam twists.
  const FOLD_POINT = { x: 0, y: 5 }

  function compileFoldOver(spanReversed: { from?: boolean; to?: boolean }) {
    const compiled = compileExplicitSeams({
      pieceMeshes: [piece('body', 'Body', 40)],
      seamConnections: [{
        id: 'fold-over',
        from: { pieceId: 'body', edgeIndex: 3 },
        to: { pieceId: 'body', edgeIndex: 3 },
        fromSpan: { pieceId: 'body', edgeIndex: 3, t0: 0, t1: 0.5, reversed: spanReversed.from },
        toSpan: { pieceId: 'body', edgeIndex: 3, t0: 0.5, t1: 1, reversed: spanReversed.to },
        kind: 'sewn',
        stitchSpacingMm: 2.5,
        // Head to tail: the far end of the second half meets the near end of the
        // first, so the fold lands on itself.
        reversed: true,
      }],
    })
    const [pair] = compiled.pairs
    return pair.left.holes.map((hole, index) => {
      const mate = pair.right.holes[index].point
      return {
        left: hole.point,
        right: mate,
        gapMm: Math.hypot(mate.x - hole.point.x, mate.y - hole.point.y),
      }
    })
  }

  it('sews the fold to itself when only the connection says reversed', () => {
    const pairs = compileFoldOver({})
    // Corners first, fold last: 10mm apart shrinking to nothing.
    expect(pairs[0].gapMm).toBeCloseTo(10, 9)
    expect(pairs[pairs.length - 1].gapMm).toBeCloseTo(0, 9)
    expect(pairs[pairs.length - 1].left).toEqual(FOLD_POINT)
    expect(pairs[pairs.length - 1].right).toEqual(FOLD_POINT)
  })

  it('does not let a reversed `to` span cancel the connection flip', () => {
    const pairs = compileFoldOver({ to: true })
    expect(pairs[0].gapMm).toBeCloseTo(10, 9)
    expect(pairs[pairs.length - 1].gapMm).toBeCloseTo(0, 9)
  })

  it('does not let a reversed `from` span cancel the connection flip', () => {
    const pairs = compileFoldOver({ from: true })
    expect(pairs[0].gapMm).toBeCloseTo(10, 9)
    expect(pairs[pairs.length - 1].gapMm).toBeCloseTo(0, 9)
  })
})
