import { describe, expect, it } from 'vitest'
import type { PatternPiece, PieceGrainline, PieceLabel, PiecePlacementLabel, PieceNotch, PieceSeamAllowance } from '../cad/cad-types'
import {
  buildPatternPieceSeamPath,
  buildPieceDerivedLabels,
  buildPieceDerivedNotches,
  buildPieceDerivedPlacementGuides,
  clonePatternPieceSelection,
  migrateLegacySeamAllowances,
} from './pattern-piece-ops'
import type { OutlineChain } from './outline-detection'

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
    const placementLabels: PiecePlacementLabel[] = [
      {
        id: 'placement-1',
        pieceId: 'piece-1',
        name: 'Snap',
        visible: true,
        kind: 'cross',
        anchor: 'edge',
        edgeIndex: 1,
        t: 0.25,
        offsetX: 1,
        offsetY: 2,
        widthMm: 5,
        heightMm: 5,
        rotationDeg: 10,
        showOnSeam: true,
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
      placementLabels,
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
    expect(cloned.piecePlacementLabels[0].pieceId).toBe(cloned.patternPieces[0].id)
    expect(cloned.piecePlacementLabels[0].id).not.toBe('placement-1')
    expect(cloned.seamAllowances[0].pieceId).toBe(cloned.patternPieces[0].id)
    expect(cloned.seamAllowances[0].edgeOverrides).toEqual([{ edgeIndex: 2, offsetMm: 5 }])
    expect(cloned.pieceNotches[0].pieceId).toBe(cloned.patternPieces[0].id)
    expect(cloned.pieceNotches[0].id).not.toBe('notch-1')
  })
})

describe('buildPieceDerivedLabels', () => {
  it('expands extended piece metadata tokens', () => {
    const piece: PatternPiece = {
      id: 'piece-1',
      name: 'Front Pocket',
      boundaryShapeId: 'shape-1',
      internalShapeIds: [],
      layerId: 'layer-1',
      quantity: 2,
      code: 'FP-01',
      material: 'Shell',
      materialSide: 'grain',
      notes: 'Skive top edge',
      annotation: 'Outer',
      onFold: true,
      mirrorPair: true,
      orientation: 'any',
      allowFlip: true,
      includeInLayout: true,
      locked: false,
    }
    const labels: PieceLabel[] = [
      {
        id: 'label-1',
        pieceId: piece.id,
        visible: true,
        kind: 'piece',
        textTemplate: '{{name}} {{code}} {{material}} {{side}} {{fold}} {{mirror}}',
        rotationDeg: 0,
        anchor: 'center',
        offsetX: 0,
        offsetY: 0,
        fontSizeMm: 8,
      },
    ]
    const chain: OutlineChain = {
      id: 'chain-1',
      shapeIds: ['shape-1'],
      polygon: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 20 },
        { x: 0, y: 20 },
        { x: 0, y: 0 },
      ],
      isClosed: true,
      area: 800,
    }

    const derived = buildPieceDerivedLabels(piece, labels, chain)

    expect(derived).toHaveLength(1)
    expect(derived[0].text).toContain('Front Pocket')
    expect(derived[0].text).toContain('FP-01')
    expect(derived[0].text).toContain('Shell')
    expect(derived[0].text).toContain('grain')
    expect(derived[0].text).toContain('On fold')
    expect(derived[0].text).toContain('Mirror pair')
  })
})

describe('buildPatternPieceSeamPath', () => {
  it('uses edge overrides when present', () => {
    const chain: OutlineChain = {
      id: 'chain-1',
      shapeIds: ['shape-1'],
      polygon: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ],
      isClosed: true,
      area: 200,
    }
    const seamAllowance: PieceSeamAllowance = {
      id: 'seam-1',
      pieceId: 'piece-1',
      enabled: true,
      defaultOffsetMm: 2,
      edgeOverrides: [{ edgeIndex: 0, offsetMm: 6 }],
    }

    const path = buildPatternPieceSeamPath(chain, seamAllowance)

    expect(path).not.toBeNull()
    expect(path).toContain('-6')
    expect(path?.endsWith('Z')).toBe(true)
  })
})

describe('buildPieceDerivedNotches', () => {
  it('samples seam-positioned notches from the seam polygon', () => {
    const piece: PatternPiece = {
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
    }
    const chain: OutlineChain = {
      id: 'chain-1',
      shapeIds: ['shape-1'],
      polygon: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ],
      isClosed: true,
      area: 200,
    }
    const seamAllowance: PieceSeamAllowance = {
      id: 'seam-1',
      pieceId: piece.id,
      enabled: true,
      defaultOffsetMm: 3,
      edgeOverrides: [],
    }

    const [boundaryNotch] = buildPieceDerivedNotches(
      piece,
      [
        {
          id: 'notch-1',
          pieceId: piece.id,
          edgeIndex: 0,
          t: 0.5,
          style: 'single',
          lengthMm: 4,
          widthMm: 0,
          angleMode: 'normal',
          showOnSeam: false,
        },
      ],
      chain,
      seamAllowance,
    )
    const [seamNotch] = buildPieceDerivedNotches(
      piece,
      [
        {
          id: 'notch-1',
          pieceId: piece.id,
          edgeIndex: 0,
          t: 0.5,
          style: 'single',
          lengthMm: 4,
          widthMm: 0,
          angleMode: 'normal',
          showOnSeam: true,
        },
      ],
      chain,
      seamAllowance,
    )

    expect(seamNotch.start.x).not.toBeCloseTo(boundaryNotch.start.x, 4)
    expect(seamNotch.start.y).not.toBeCloseTo(boundaryNotch.start.y, 4)
  })
})

describe('buildPieceDerivedPlacementGuides', () => {
  it('positions edge-anchored placement labels on the seam path', () => {
    const piece: PatternPiece = {
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
    }
    const chain: OutlineChain = {
      id: 'chain-1',
      shapeIds: ['shape-1'],
      polygon: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ],
      isClosed: true,
      area: 200,
    }
    const seamAllowance: PieceSeamAllowance = {
      id: 'seam-1',
      pieceId: piece.id,
      enabled: true,
      defaultOffsetMm: 3,
      edgeOverrides: [],
    }

    const [boundaryGuide] = buildPieceDerivedPlacementGuides(
      piece,
      [
        {
          id: 'placement-1',
          pieceId: piece.id,
          name: 'Snap',
          visible: true,
          kind: 'cross',
          anchor: 'edge',
          edgeIndex: 0,
          t: 0.5,
          offsetX: 0,
          offsetY: 0,
          widthMm: 6,
          heightMm: 6,
          rotationDeg: 0,
          showOnSeam: false,
        },
      ],
      chain,
      seamAllowance,
    )
    const [guide] = buildPieceDerivedPlacementGuides(
      piece,
      [
        {
          id: 'placement-1',
          pieceId: piece.id,
          name: 'Snap',
          visible: true,
          kind: 'cross',
          anchor: 'edge',
          edgeIndex: 0,
          t: 0.5,
          offsetX: 0,
          offsetY: 0,
          widthMm: 6,
          heightMm: 6,
          rotationDeg: 0,
          showOnSeam: true,
        },
      ],
      chain,
      seamAllowance,
    )

    expect(guide.point.x).not.toBeCloseTo(boundaryGuide.point.x, 4)
    expect(guide.point.y).not.toBeCloseTo(boundaryGuide.point.y, 4)
    expect(Number.isFinite(guide.rotationDeg)).toBe(true)
  })
})
