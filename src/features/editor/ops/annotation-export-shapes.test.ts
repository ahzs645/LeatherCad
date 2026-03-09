import { describe, expect, it } from 'vitest'
import type { PatternPiece } from '../cad/cad-types'
import { buildAnnotationExportShapes } from './annotation-export-shapes'

describe('buildAnnotationExportShapes', () => {
  const piece: PatternPiece = {
    id: 'piece-1',
    name: 'Front',
    boundaryShapeId: 'shape-1',
    internalShapeIds: ['shape-2'],
    layerId: 'layer-1',
    quantity: 1,
    onFold: false,
    orientation: 'any',
    allowFlip: true,
    includeInLayout: true,
    locked: false,
  }

  it('builds text and line annotation shapes for export', () => {
    const shapes = buildAnnotationExportShapes({
      showAnnotations: true,
      onlySelected: false,
      selectedShapeIdSet: new Set<string>(),
      patternPiecesById: { [piece.id]: piece },
      annotationLabels: [{ id: 'label-1', text: 'Front x1', point: { x: 10, y: 12 }, pieceId: piece.id, kind: 'piece' }],
      pieceGrainlineSegments: [{ pieceId: piece.id, start: { x: 0, y: 0 }, end: { x: 0, y: 20 } }],
      pieceNotchLines: [{ id: 'notch-1', pieceId: piece.id, start: { x: 5, y: 5 }, end: { x: 7, y: 8 }, showOnSeam: true }],
      fallbackLayerId: 'fallback-layer',
      annotationLineTypeId: 'mark-line',
    })

    expect(shapes).toHaveLength(3)
    expect(shapes.filter((shape) => shape.type === 'text')).toHaveLength(1)
    expect(shapes.every((shape) => shape.layerId === 'layer-1')).toBe(true)
    expect(shapes.every((shape) => shape.lineTypeId === 'mark-line')).toBe(true)
  })

  it('filters piece annotations when exporting selected content only', () => {
    const shapes = buildAnnotationExportShapes({
      showAnnotations: true,
      onlySelected: true,
      selectedShapeIdSet: new Set<string>(['shape-1']),
      patternPiecesById: { [piece.id]: piece },
      annotationLabels: [
        { id: 'label-1', text: 'Front x1', point: { x: 10, y: 12 }, pieceId: piece.id, kind: 'piece' },
        { id: 'label-2', text: 'Loose note', point: { x: 0, y: 0 }, kind: 'generic' },
      ],
      pieceGrainlineSegments: [{ pieceId: piece.id, start: { x: 0, y: 0 }, end: { x: 0, y: 20 } }],
      pieceNotchLines: [],
      fallbackLayerId: 'fallback-layer',
      annotationLineTypeId: 'mark-line',
    })

    expect(shapes).toHaveLength(2)
    expect(shapes.every((shape) => shape.layerId === 'layer-1')).toBe(true)
  })
})
