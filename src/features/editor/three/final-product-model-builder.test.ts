import { Group, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import type { FoldLine, StitchHole } from '../cad/cad-types'
import { rebuildFinalProductModel } from './final-product-model-builder'

function createMaterials() {
  return {
    leftMaterial: new MeshStandardMaterial(),
    rightMaterial: new MeshStandardMaterial(),
    leftTextureMaterial: new MeshStandardMaterial(),
    rightTextureMaterial: new MeshStandardMaterial(),
    assembledFrontMaterial: new MeshStandardMaterial(),
    assembledBackMaterial: new MeshStandardMaterial(),
    assembledSideMaterial: new MeshStandardMaterial(),
  }
}

function foldLine(id: string, start: { x: number; y: number }, end: { x: number; y: number }): FoldLine {
  return {
    id,
    name: id,
    start,
    end,
    angleDeg: 180,
    maxAngleDeg: 180,
    direction: 'mountain',
  }
}

function chain(id: string, points: Array<{ x: number; y: number }>): StitchHole[] {
  return points.map((point, index) => ({
    id: `${id}-${index}`,
    shapeId: `${id}-shape-${index}`,
    chainId: id,
    point,
    angleDeg: 0,
    holeType: 'round',
    sequence: index,
  }))
}

function row(id: string, count: number, x: number, y: number, pitch = 3, reverse = false) {
  const points = Array.from({ length: count }, (_, index) => ({
    x: x + index * pitch,
    y,
  }))
  return chain(id, reverse ? points.reverse() : points)
}

function column(id: string, count: number, x: number, y: number, pitch = 3, reverse = false) {
  const points = Array.from({ length: count }, (_, index) => ({
    x,
    y: y + index * pitch,
  }))
  return chain(id, reverse ? points.reverse() : points)
}

describe('final product model builder', () => {
  it('builds a non-empty final product group and reports four paired stitch chains', () => {
    const finalProductGroup = new Group()
    const result = rebuildFinalProductModel({
      layers: [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false }],
      lineTypes: [],
      shapes: [],
      foldLines: [
        foldLine('vertical-fold', { x: 30, y: -10 }, { x: 30, y: 70 }),
        foldLine('horizontal-fold', { x: -10, y: 30 }, { x: 70, y: 30 }),
      ],
      stitchHoles: [
        ...column('a7', 7, 10, 5),
        ...column('b7', 7, 50, 5, 3, true),
        ...row('c4', 4, 5, 22),
        ...row('d4', 4, 5, 38, 3, true),
        ...row('e4', 4, 46, 22),
        ...row('f4', 4, 46, 38, 3, true),
        ...column('g7', 7, 10, 37),
        ...column('h7', 7, 50, 37, 3, true),
      ],
      outlinePolygons: [{
        layerId: 'layer-1',
        shapeIds: ['outline'],
        polygon: [
          { x: 0, y: 0 },
          { x: 60, y: 0 },
          { x: 60, y: 60 },
          { x: 0, y: 60 },
        ],
      }],
      patternPieces: [],
      piecePlacements3d: [],
      seamConnections: [],
      previewSettings: {
        mode: 'final',
        explodedFactor: 0,
        finalFoldProgress: 1,
        finalFoldCamera: 'orbit',
        thicknessMm: 2,
        showSeams: true,
        showEdgeLabels: false,
        showPieceOutlines: false,
        showStressOverlay: true,
        usePhysicsRelaxation: true,
      },
      pieceMeshes: [],
      transform: { scale: 0.02, centerX: 30, centerY: 30 },
      documentBounds: { minX: 0, maxX: 60, minY: 0, maxY: 60 },
      threadColor: '#fb923c',
      texturedShapeIdSet: new Set(),
      hasActiveTexture: false,
      materials: createMaterials(),
      preservedMaterials: new Set(),
      fitControlsToModel: () => undefined,
      finalProductGroup,
      staticSideGroup: new Group(),
      foldingSideGroup: new Group(),
      foldGuideGroup: new Group(),
      assembledGroup: new Group(),
      avatarGroup: new Group(),
    })

    expect(finalProductGroup.children.length).toBeGreaterThan(0)
    expect(finalProductGroup.children.some((child) => child.name.startsWith('final-product-hinge-spine-'))).toBe(false)
    expect(result.stitchPairs).toHaveLength(4)
  })
})
