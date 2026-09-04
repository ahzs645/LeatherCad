import { describe, expect, it } from 'vitest'
import { compileAiBuilderDocument } from '../ai-builder/ai-builder-compile'
import type { AiBuilderDocumentV1 } from '../ai-builder/ai-builder-types'
import { buildPieceDocument } from './webmcp-document'
import { measurePatternPieces, measureStitchRunMm, summarizeDocument } from './webmcp-measure'

function panelDoc(overrides: Partial<Parameters<typeof buildPieceDocument>[0]> = {}) {
  return compileAiBuilderDocument(
    buildPieceDocument({
      name: 'Wallet body',
      layerName: 'Agent',
      outline: {
        kind: 'rounded_rect',
        widthMm: 90,
        heightMm: 64,
        cornerRadiusMm: 6,
        strapEnd: 'round',
        scoopMm: 12,
      },
      center: { x: 0, y: 0 },
      quantity: 2,
      material: '3.2mm veg tan',
      onFold: false,
      stitchInsetMm: 4,
      stitchPitchMm: 4,
      seamAllowanceMm: null,
      ...overrides,
    }).document,
  ).doc
}

describe('measurePatternPieces', () => {
  it('measures the piece the app resolved, not the numbers it was asked for', () => {
    const [piece] = measurePatternPieces(panelDoc())

    expect(piece.name).toBe('Wallet body')
    expect(piece.quantity).toBe(2)
    expect(piece.material).toBe('3.2mm veg tan')
    expect(piece.widthMm).toBeCloseTo(90, 1)
    expect(piece.heightMm).toBeCloseTo(64, 1)
    // 90 x 64 less the four corner radii: 5760 - (4 - pi) * 36.
    expect(piece.cutAreaMm2).toBeGreaterThan(5700)
    expect(piece.cutAreaMm2).toBeLessThan(5760)
    // Two straight runs per axis plus one full circle of corner.
    expect(piece.perimeterMm).toBeCloseTo(2 * 78 + 2 * 52 + 2 * Math.PI * 6, 0)
  })

  it('counts the stitch holes that belong to the piece', () => {
    const [piece] = measurePatternPieces(panelDoc())
    expect(piece.stitchHoleCount).toBeGreaterThan(50)
  })

  it('reports a piece whose boundary does not close instead of inventing one', () => {
    const open: AiBuilderDocumentV1 = {
      schema_version: 1,
      document_name: 'Open piece',
      units: 'mm',
      layers: [{ id: 'body', name: 'Body' }],
      entities: [
        {
          id: 'stray_edge',
          type: 'line',
          layer_id: 'body',
          start: { x: 0, y: 0 },
          end: { x: 50, y: 0 },
          line_role: 'cut',
        },
        {
          id: 'broken_piece',
          type: 'pattern_piece',
          layer_id: 'body',
          boundary_entity_id: 'stray_edge',
          name: 'Broken',
        },
      ],
    }

    const [piece] = measurePatternPieces(compileAiBuilderDocument(open).doc)

    expect(piece.name).toBe('Broken')
    expect(piece.perimeterMm).toBe(0)
    expect(piece.cutAreaMm2).toBe(0)
  })
})

describe('measureStitchRunMm', () => {
  it('measures hole to hole along each stitched shape', () => {
    const holes = [
      { id: 'a', shapeId: 's1', point: { x: 0, y: 0 }, angleDeg: 0, holeType: 'round' as const, sequence: 1 },
      { id: 'b', shapeId: 's1', point: { x: 10, y: 0 }, angleDeg: 0, holeType: 'round' as const, sequence: 2 },
      { id: 'c', shapeId: 's1', point: { x: 25, y: 0 }, angleDeg: 0, holeType: 'round' as const, sequence: 3 },
    ]
    expect(measureStitchRunMm(holes)).toBeCloseTo(25, 6)
  })

  it('does not leap between two separate stitch runs', () => {
    const holes = [
      { id: 'a', shapeId: 's1', point: { x: 0, y: 0 }, angleDeg: 0, holeType: 'round' as const, sequence: 1 },
      { id: 'b', shapeId: 's1', point: { x: 10, y: 0 }, angleDeg: 0, holeType: 'round' as const, sequence: 2 },
      { id: 'c', shapeId: 's2', point: { x: 500, y: 0 }, angleDeg: 0, holeType: 'round' as const, sequence: 3 },
      { id: 'd', shapeId: 's2', point: { x: 510, y: 0 }, angleDeg: 0, holeType: 'round' as const, sequence: 4 },
    ]
    expect(measureStitchRunMm(holes)).toBeCloseTo(20, 6)
  })
})

describe('summarizeDocument', () => {
  it('multiplies each piece by how many of it are cut', () => {
    const summary = summarizeDocument(panelDoc())
    const [piece] = summary.pieces
    expect(summary.totalCutAreaMm2).toBeCloseTo(piece.cutAreaMm2 * 2, 3)
    expect(summary.unresolvedPieceCount).toBe(0)
    expect(summary.totalStitchRunMm).toBeGreaterThan(200)
  })
})
