import { describe, expect, it } from 'vitest'
import type { PatternPiece, PieceGrainline, PieceLabel, PieceNotch, PieceSeamAllowance } from '../cad/cad-types'
import { clonePatternPieceSelection, migrateLegacySeamAllowances } from './pattern-piece-ops'

describe('migrateLegacySeamAllowances', () => {
  it('migrates matching legacy shape seam allowances onto pattern pieces', () => {
    const patternPieces: PatternPiece[] = [
      {
        id: 'piece-1',
        name: 'Front',
        boundaryShapeId: 'shape-1',
        internalShapeIds: [],
        layerId: 'layer-1',
        quantity: 1,
        onFold: false,
        orientation: 'any',
        allowFlip: true,
        includeInLayout: true,
        locked: false,
      },
    ]

    const migrated = migrateLegacySeamAllowances(
      [
        { id: 'legacy-1', shapeId: 'shape-1', offsetMm: 4.5 },
        { id: 'legacy-2', shapeId: 'shape-missing', offsetMm: 7 },
      ],
      patternPieces,
    )

    expect(migrated).toHaveLength(1)
    expect(migrated[0].pieceId).toBe('piece-1')
    expect(migrated[0].defaultOffsetMm).toBe(4.5)
    expect(migrated[0].enabled).toBe(true)
  })
})

describe('clonePatternPieceSelection', () => {
  it('clones piece metadata and remaps shape and piece ids', () => {
    const pieces: PatternPiece[] = [
      {
        id: 'piece-1',
        name: 'Front',
        boundaryShapeId: 'shape-1',
        internalShapeIds: ['shape-2'],
        layerId: 'layer-1',
        quantity: 2,
        annotation: 'Outer shell',
        onFold: false,
        orientation: 'vertical',
        allowFlip: false,
        includeInLayout: true,
        locked: false,
      },
    ]
    const grainlines: PieceGrainline[] = [
      { pieceId: 'piece-1', visible: true, mode: 'fixed', lengthMm: 30, rotationDeg: 90, anchor: 'center' },
    ]
    const labels: PieceLabel[] = [
      {
        id: 'label-1',
        pieceId: 'piece-1',
        visible: true,
        kind: 'piece',
        textTemplate: '{{name}}',
        rotationDeg: 0,
        anchor: 'center',
        offsetX: 1,
        offsetY: 2,
        fontSizeMm: 7,
      },
    ]
    const seamAllowances: PieceSeamAllowance[] = [
      {
        id: 'seam-1',
        pieceId: 'piece-1',
        enabled: true,
        defaultOffsetMm: 3,
        edgeOverrides: [{ edgeIndex: 2, offsetMm: 5 }],
      },
    ]
    const notches: PieceNotch[] = [
      {
        id: 'notch-1',
        pieceId: 'piece-1',
        edgeIndex: 1,
        t: 0.5,
        style: 'double',
        lengthMm: 4,
        widthMm: 2,
        angleMode: 'normal',
        showOnSeam: true,
      },
    ]

    const cloned = clonePatternPieceSelection(
      pieces,
      grainlines,
      labels,
      seamAllowances,
      notches,
      new Map([
        ['shape-1', 'shape-1-copy'],
        ['shape-2', 'shape-2-copy'],
      ]),
    )

    expect(cloned.patternPieces).toHaveLength(1)
    expect(cloned.patternPieces[0].id).not.toBe('piece-1')
    expect(cloned.patternPieces[0].boundaryShapeId).toBe('shape-1-copy')
    expect(cloned.patternPieces[0].internalShapeIds).toEqual(['shape-2-copy'])
    expect(cloned.pieceGrainlines[0].pieceId).toBe(cloned.patternPieces[0].id)
    expect(cloned.pieceLabels[0].pieceId).toBe(cloned.patternPieces[0].id)
    expect(cloned.pieceLabels[0].id).not.toBe('label-1')
    expect(cloned.seamAllowances[0].pieceId).toBe(cloned.patternPieces[0].id)
    expect(cloned.seamAllowances[0].edgeOverrides).toEqual([{ edgeIndex: 2, offsetMm: 5 }])
    expect(cloned.pieceNotches[0].pieceId).toBe(cloned.patternPieces[0].id)
    expect(cloned.pieceNotches[0].id).not.toBe('notch-1')
  })
})
