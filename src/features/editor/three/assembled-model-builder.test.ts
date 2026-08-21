import { Group, Material, MeshStandardMaterial } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { Layer, PatternPiece, ThreePreviewSettings } from '../cad/cad-types'
import type { PieceMeshData } from './piece-mesh'
import { ThreeAvatarManager } from './avatar-manager'
import { rebuildAssembledModel } from './assembled-model-builder'

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

const layer: Layer = { id: 'layer-1', name: 'Front', visible: true, locked: false }

function previewSettings(overrides: Partial<ThreePreviewSettings> = {}): ThreePreviewSettings {
  return {
    mode: 'avatar',
    explodedFactor: 0,
    finalFoldProgress: 1,
    finalFoldCamera: 'orbit',
    thicknessMm: 2,
    showSeams: false,
    showEdgeLabels: false,
    showStressOverlay: false,
    usePhysicsRelaxation: true,
    ...overrides,
  }
}

function squarePiece(): { piece: PatternPiece; pieceMesh: PieceMeshData } {
  const outer = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 40 },
    { x: 0, y: 40 },
  ]
  return {
    piece: {
      id: 'piece-1',
      name: 'Front Panel',
      boundaryShapeId: 'shape-1',
      internalShapeIds: [],
      layerId: layer.id,
      quantity: 1,
      onFold: false,
      orientation: 'any',
      allowFlip: true,
      includeInLayout: true,
      locked: false,
    },
    pieceMesh: {
      pieceId: 'piece-1',
      name: 'Front Panel',
      outer,
      holes: [],
      shapeSegments: [],
      bounds: { minX: 0, minY: 0, maxX: 40, maxY: 40, width: 40, height: 40 },
      center: { x: 20, y: 20 },
      edges: outer.map((start, index) => {
        const end = outer[(index + 1) % outer.length]
        return {
          index,
          start,
          end,
          midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
          lengthMm: Math.hypot(end.x - start.x, end.y - start.y),
        }
      }),
    },
  }
}

function runBuilder({
  patternPieces,
  pieceMeshes,
  mode,
}: {
  patternPieces: PatternPiece[]
  pieceMeshes: PieceMeshData[]
  mode: ThreePreviewSettings['mode']
}) {
  const assembledGroup = new Group()
  const avatarGroup = new Group()
  const fitControlsToModel = vi.fn()
  const rebuildAvatarModel = vi.fn(async () => undefined)

  rebuildAssembledModel({
    layers: [layer],
    lineTypes: [],
    shapes: [],
    foldLines: [],
    stitchHoles: [],
    outlinePolygons: [],
    patternPieces,
    piecePlacements3d: [],
    seamConnections: [],
    previewSettings: previewSettings({ mode }),
    pieceMeshes,
    transform: { scale: 0.02, centerX: 20, centerY: 20 },
    documentBounds: { minX: 0, maxX: 40, minY: 0, maxY: 40 },
    threadColor: '#fb923c',
    texturedShapeIdSet: new Set(),
    hasActiveTexture: false,
    materials: createMaterials(),
    preservedMaterials: new Set(),
    fitControlsToModel,
    assembledGroup,
    finalProductGroup: new Group(),
    staticSideGroup: new Group(),
    foldingSideGroup: new Group(),
    foldGuideGroup: new Group(),
    avatarGroup,
    rebuildAvatarModel,
  })

  return { assembledGroup, avatarGroup, fitControlsToModel, rebuildAvatarModel }
}

describe('rebuildAssembledModel', () => {
  it('still rebuilds the avatar when the document has no pattern pieces', () => {
    const result = runBuilder({ patternPieces: [], pieceMeshes: [], mode: 'avatar' })

    expect(result.assembledGroup.children).toHaveLength(0)
    expect(result.rebuildAvatarModel).toHaveBeenCalledOnce()
    expect(result.fitControlsToModel).toHaveBeenCalledOnce()
  })

  it('rebuilds the avatar on the no-pieces path in assembled mode too', () => {
    // The avatar manager is mode-gated internally, so assembled mode stays free of a
    // mannequin; the call is what keeps both modes on one code path.
    const result = runBuilder({ patternPieces: [], pieceMeshes: [], mode: 'assembled' })

    expect(result.rebuildAvatarModel).toHaveBeenCalledOnce()
    expect(result.fitControlsToModel).toHaveBeenCalledOnce()
  })

  it('builds piece geometry and rebuilds the avatar when pieces exist', () => {
    const { piece, pieceMesh } = squarePiece()
    const result = runBuilder({ patternPieces: [piece], pieceMeshes: [pieceMesh], mode: 'avatar' })

    expect(result.assembledGroup.children).toHaveLength(1)
    expect(result.rebuildAvatarModel).toHaveBeenCalledOnce()
    expect(result.fitControlsToModel).toHaveBeenCalledOnce()
  })

  it('puts the built-in mannequin in the scene for avatar mode with zero pieces', () => {
    const avatarManager = new ThreeAvatarManager()
    const assembledGroup = new Group()
    const avatarGroup = new Group()
    const preservedMaterials = new Set<Material>()
    const settings = previewSettings({ mode: 'avatar' })

    rebuildAssembledModel({
      layers: [layer],
      lineTypes: [],
      shapes: [],
      foldLines: [],
      stitchHoles: [],
      outlinePolygons: [],
      patternPieces: [],
      piecePlacements3d: [],
      seamConnections: [],
      previewSettings: settings,
      pieceMeshes: [],
      transform: { scale: 0.02, centerX: 20, centerY: 20 },
      documentBounds: { minX: 0, maxX: 40, minY: 0, maxY: 40 },
      threadColor: '#fb923c',
      texturedShapeIdSet: new Set(),
      hasActiveTexture: false,
      materials: createMaterials(),
      preservedMaterials,
      fitControlsToModel: () => undefined,
      assembledGroup,
      finalProductGroup: new Group(),
      staticSideGroup: new Group(),
      foldingSideGroup: new Group(),
      foldGuideGroup: new Group(),
      avatarGroup,
      rebuildAvatarModel: () =>
        avatarManager.rebuildAvatarModel({
          avatarGroup,
          avatars: [],
          previewSettings: settings,
          transformScale: 0.02,
          preservedMaterials,
          fitControlsToModel: () => undefined,
        }),
    })

    // The procedural fallback is added before the first await, so the model is
    // already framable by the time the builder calls fitControlsToModel.
    expect(assembledGroup.children).toHaveLength(0)
    expect(avatarGroup.children).toHaveLength(1)
  })

  it('leaves assembled mode free of the mannequin with zero pieces', () => {
    const avatarManager = new ThreeAvatarManager()
    const avatarGroup = new Group()
    const preservedMaterials = new Set<Material>()
    const settings = previewSettings({ mode: 'assembled' })

    rebuildAssembledModel({
      layers: [layer],
      lineTypes: [],
      shapes: [],
      foldLines: [],
      stitchHoles: [],
      outlinePolygons: [],
      patternPieces: [],
      piecePlacements3d: [],
      seamConnections: [],
      previewSettings: settings,
      pieceMeshes: [],
      transform: { scale: 0.02, centerX: 20, centerY: 20 },
      documentBounds: { minX: 0, maxX: 40, minY: 0, maxY: 40 },
      threadColor: '#fb923c',
      texturedShapeIdSet: new Set(),
      hasActiveTexture: false,
      materials: createMaterials(),
      preservedMaterials,
      fitControlsToModel: () => undefined,
      assembledGroup: new Group(),
      finalProductGroup: new Group(),
      staticSideGroup: new Group(),
      foldingSideGroup: new Group(),
      foldGuideGroup: new Group(),
      avatarGroup,
      rebuildAvatarModel: () =>
        avatarManager.rebuildAvatarModel({
          avatarGroup,
          avatars: [],
          previewSettings: settings,
          transformScale: 0.02,
          preservedMaterials,
          fitControlsToModel: () => undefined,
        }),
    })

    expect(avatarGroup.children).toHaveLength(0)
  })

  it('clears stale piece geometry when the last piece disappears', () => {
    const { piece, pieceMesh } = squarePiece()
    const assembledGroup = new Group()
    const avatarGroup = new Group()
    const shared = {
      layers: [layer],
      lineTypes: [],
      shapes: [],
      foldLines: [],
      stitchHoles: [],
      outlinePolygons: [],
      piecePlacements3d: [],
      seamConnections: [],
      previewSettings: previewSettings(),
      transform: { scale: 0.02, centerX: 20, centerY: 20 },
      documentBounds: { minX: 0, maxX: 40, minY: 0, maxY: 40 },
      threadColor: '#fb923c',
      texturedShapeIdSet: new Set<string>(),
      hasActiveTexture: false,
      materials: createMaterials(),
      preservedMaterials: new Set<Material>(),
      fitControlsToModel: () => undefined,
      assembledGroup,
      finalProductGroup: new Group(),
      staticSideGroup: new Group(),
      foldingSideGroup: new Group(),
      foldGuideGroup: new Group(),
      avatarGroup,
      rebuildAvatarModel: async () => undefined,
    }

    rebuildAssembledModel({ ...shared, patternPieces: [piece], pieceMeshes: [pieceMesh] })
    expect(assembledGroup.children).toHaveLength(1)

    rebuildAssembledModel({ ...shared, patternPieces: [], pieceMeshes: [] })
    expect(assembledGroup.children).toHaveLength(0)
    expect(avatarGroup.children).toHaveLength(0)
  })
})
