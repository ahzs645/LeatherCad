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
