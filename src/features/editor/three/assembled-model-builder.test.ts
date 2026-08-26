import { Box3, BufferAttribute, DoubleSide, Group, InstancedMesh, Line, LineBasicMaterial, Material, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { FoldLine, Layer, PatternPiece, PiecePlacement3D, Point, SeamConnection, StitchHole, ThreePreviewSettings } from '../cad/cad-types'
import type { PieceMeshData } from './piece-mesh'
import { ThreeAvatarManager } from './avatar-manager'
import { rebuildAssembledModel } from './assembled-model-builder'
import { ASSEMBLED_DRAPE_MESH_NAME } from './assembled-model-builder'
import { pieceFrameForObject, worldPointToDocument } from './seam-edge-picking'
import { createSharedMaterials } from './shared-materials'

function createMaterials() {
  return {
    shared: createSharedMaterials(),
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

/** The document-to-scene mapping every build in this file uses. */
const TRANSFORM = { scale: 0.02, centerX: 20, centerY: 20 }

function previewSettings(overrides: Partial<ThreePreviewSettings> = {}): ThreePreviewSettings {
  return {
    mode: 'avatar',
    explodedFactor: 0,
    finalFoldProgress: 1,
    finalFoldCamera: 'orbit',
    thicknessMm: 2,
    showSeams: false,
    showEdgeLabels: false,
    showPieceOutlines: false,
    showStressOverlay: false,
    showFoldStressOverlay: false,
    showFoldClashOverlay: false,
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
  foldLines = [],
  stitchHoles = [],
  seamConnections = [],
  piecePlacements3d = [],
  settings,
  materials = createMaterials(),
}: {
  patternPieces: PatternPiece[]
  pieceMeshes: PieceMeshData[]
  mode: ThreePreviewSettings['mode']
  foldLines?: FoldLine[]
  stitchHoles?: StitchHole[]
  seamConnections?: SeamConnection[]
  piecePlacements3d?: PiecePlacement3D[]
  settings?: Partial<ThreePreviewSettings>
  materials?: ReturnType<typeof createMaterials>
}) {
  const assembledGroup = new Group()
  const avatarGroup = new Group()
  const fitControlsToModel = vi.fn()
  const rebuildAvatarModel = vi.fn(async () => undefined)

  rebuildAssembledModel({
    layers: [layer],
    lineTypes: [],
    shapes: [],
    foldLines,
    stitchHoles,
    outlinePolygons: [],
    patternPieces,
    piecePlacements3d,
    seamConnections,
    previewSettings: previewSettings({ mode, ...settings }),
    pieceMeshes,
    transform: TRANSFORM,
    documentBounds: { minX: 0, maxX: 40, minY: 0, maxY: 40 },
    threadColor: '#fb923c',
    texturedShapeIdSet: new Set(),
    hasActiveTexture: false,
    materials,
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

  return { assembledGroup, avatarGroup, fitControlsToModel, rebuildAvatarModel, materials }
}

function foldLine(overrides: Partial<FoldLine> = {}): FoldLine {
  return {
    id: 'fold-1',
    name: 'Wallet spine',
    pieceId: 'piece-1',
    start: { x: 0, y: 20 },
    end: { x: 40, y: 20 },
    angleDeg: 90,
    maxAngleDeg: 180,
    direction: 'valley',
    ...overrides,
  }
}

/**
 * Tallest a flat build of the fixture gets: 2mm of leather at the 0.02 scale
 * this transform uses, plus the hairline offsets the outline and back face sit
 * at. Anything above this is leather standing up.
 */
const FLAT_HEIGHT = 0.06

/** Height of the built leather, in scene units. */
function modelHeight(group: Group) {
  const box = new Box3().setFromObject(group)
  return box.max.y - box.min.y
}

function meshes(group: Group) {
  const found: Mesh[] = []
  group.traverse((object) => {
    if (object instanceof Mesh) {
      found.push(object as Mesh)
    }
  })
  return found
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
      transform: TRANSFORM,
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
      transform: TRANSFORM,
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
      transform: TRANSFORM,
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
  describe('folds', () => {
    /** The drape's mid-surface samples: document uv1 with the world position. */
    const drapeSamples = (group: Group) => {
      group.updateMatrixWorld(true)
      const samples: Array<{ document: { x: number; y: number }; world: Vector3 }> = []
      group.traverse((object) => {
        if (!(object instanceof Mesh) || object.name !== ASSEMBLED_DRAPE_MESH_NAME) {
          return
        }
        const mesh = object as Mesh
        const uvDocument = mesh.geometry.getAttribute('uv1')
        const position = mesh.geometry.getAttribute('position')
        if (!uvDocument || !position) {
          return
        }
        for (let index = 0; index < position.count; index += 1) {
          samples.push({
            document: { x: uvDocument.getX(index), y: uvDocument.getY(index) },
            world: new Vector3().fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld),
          })
        }
      })
      return samples
    }

    it('leaves a piece flat when no fold line reaches it', () => {
      const { piece, pieceMesh } = squarePiece()
      const result = runBuilder({ patternPieces: [piece], pieceMeshes: [pieceMesh], mode: 'assembled' })

      // 2mm of leather at the 0.02 scale of this fixture, plus the hairline
      // offsets the outline and back face sit at.
      expect(modelHeight(result.assembledGroup)).toBeLessThan(FLAT_HEIGHT)
    })

    it('stays flat while the crease is dialled to zero', () => {
      const { piece, pieceMesh } = squarePiece()
      const result = runBuilder({
        patternPieces: [piece],
        pieceMeshes: [pieceMesh],
        mode: 'assembled',
        foldLines: [foldLine({ angleDeg: 0 })],
      })

      expect(modelHeight(result.assembledGroup)).toBeLessThan(FLAT_HEIGHT)
    })

    it('lifts the half past the crease when the fold angle is dialled up', () => {
      const { piece, pieceMesh } = squarePiece()
      const result = runBuilder({
        patternPieces: [piece],
        pieceMeshes: [pieceMesh],
        mode: 'assembled',
        foldLines: [foldLine({ angleDeg: 90 })],
      })

      // The swinging half is 20mm deep, so folding it to a right angle stands
      // 20mm of leather up: 0.4 at this fixture's scale.
      expect(modelHeight(result.assembledGroup)).toBeGreaterThan(0.35)
      expect(result.assembledGroup.getObjectByName('assembled-fold-fold-1')).toBeDefined()
    })

    it('ignores a crease belonging to another piece', () => {
      const { piece, pieceMesh } = squarePiece()
      const result = runBuilder({
        patternPieces: [piece],
        pieceMeshes: [pieceMesh],
        mode: 'assembled',
        foldLines: [foldLine({ pieceId: 'piece-2' })],
      })

      expect(modelHeight(result.assembledGroup)).toBeLessThan(FLAT_HEIGHT)
    })

    it('ignores an unattributed crease drawn outside the piece', () => {
      // The split clips against the infinite line through the crease, so a
      // crease that merely lines up with this piece must not slice it.
      const { piece, pieceMesh } = squarePiece()
      const result = runBuilder({
        patternPieces: [piece],
        pieceMeshes: [pieceMesh],
        mode: 'assembled',
        foldLines: [foldLine({ pieceId: undefined, start: { x: 200, y: 20 }, end: { x: 240, y: 20 } })],
      })

      expect(modelHeight(result.assembledGroup)).toBeLessThan(FLAT_HEIGHT)
    })

    it('wraps the crease in leather rather than leaving two cut edges', () => {
      const { piece, pieceMesh } = squarePiece()
      const build = (angleDeg: number) =>
        runBuilder({
          patternPieces: [piece],
          pieceMeshes: [pieceMesh],
          mode: 'assembled',
          foldLines: [foldLine({ angleDeg })],
        }).assembledGroup

      const bendVertices = (group: Group) => {
        let count = 0
        group.traverse((object) => {
          if (object instanceof Mesh && object.material instanceof MeshStandardMaterial && object.material.side === DoubleSide) {
            count += (object as Mesh).geometry.getAttribute('position').count
          }
        })
        return count
      }

      // Flat, the two halves are one surface and there is nothing to wrap.
      expect(bendVertices(build(0))).toBe(0)
      expect(bendVertices(build(90))).toBeGreaterThan(0)
    })

    it('rolls the crease through an arc instead of a corner', () => {
      const { piece, pieceMesh } = squarePiece()
      const bendRadiusMm = 4
      const group = runBuilder({
        patternPieces: [piece],
        pieceMeshes: [pieceMesh],
        mode: 'assembled',
        foldLines: [foldLine({ angleDeg: 90, radiusMm: bendRadiusMm })],
      }).assembledGroup

      // The bend zone is the arc's worth of material either side of the
      // crease. A valley fold carries the flap down, so surface heights in
      // the zone must pass through the middle of the turn — a knife crease
      // has no material at intermediate heights at all.
      const radius = bendRadiusMm * TRANSFORM.scale
      const zoneMm = (bendRadiusMm * Math.PI) / 4
      const samples = drapeSamples(group)
      expect(samples.length).toBeGreaterThan(0)
      const zoneHeights = samples
        .filter((sample) => Math.abs(sample.document.y - 20) <= zoneMm)
        .map((sample) => sample.world.y)
      expect(zoneHeights.length).toBeGreaterThan(3)
      expect(Math.min(...zoneHeights)).toBeLessThan(-radius * 0.2)
      const midArc = zoneHeights.filter(
        (height) => height < -radius * 0.15 && height > -radius * 1.1,
      )
      expect(midArc.length).toBeGreaterThan(0)
    })

    it('draws a skived crease at the thickness it was skived to', () => {
      const { piece, pieceMesh } = squarePiece()
      // The shell's grain and flesh surfaces are the same mid-surface pushed
      // either way along its normal, so every sample sharing a document point
      // is a leather's thickness from its opposite number. That spread is the
      // thickness a person actually sees, read back off the built geometry.
      const drawnThicknessMm = (foldThicknessMm: number, documentY: number) => {
        const group = runBuilder({
          patternPieces: [piece],
          pieceMeshes: [pieceMesh],
          mode: 'assembled',
          foldLines: [foldLine({ angleDeg: 90, radiusMm: 1.2, thicknessMm: foldThicknessMm })],
        }).assembledGroup
        const byPoint = new Map<string, Vector3[]>()
        for (const sample of drapeSamples(group)) {
          const key = `${sample.document.x}|${sample.document.y}`
          const bucket = byPoint.get(key)
          if (bucket) bucket.push(sample.world)
          else byPoint.set(key, [sample.world])
        }
        let nearest: Vector3[] = []
        let nearestDistance = Number.POSITIVE_INFINITY
        for (const [key, bucket] of byPoint) {
          if (bucket.length < 2) continue
          const [x, y] = key.split('|').map(Number)
          const distance = Math.hypot(x - 20, y - documentY)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearest = bucket
          }
        }
        expect(nearest.length).toBeGreaterThan(1)
        let spread = 0
        for (const a of nearest) {
          for (const b of nearest) spread = Math.max(spread, a.distanceTo(b))
        }
        return spread / TRANSFORM.scale
      }

      // The fixture's panel is 2 mm. Unskived it is 2 mm everywhere; skived to
      // 1 mm the spine halves and the flap, well past the bevel, does not.
      expect(drawnThicknessMm(2, 20)).toBeCloseTo(2, 6)
      expect(drawnThicknessMm(2, 2)).toBeCloseTo(2, 6)
      expect(drawnThicknessMm(1, 20)).toBeCloseTo(1, 6)
      expect(drawnThicknessMm(1, 2)).toBeCloseTo(2, 6)
    })

    it('keeps the leather continuous across the crease, whichever way it runs', () => {
      const { piece, pieceMesh } = squarePiece()
      // The region's boundary winds however the clip left it, so a crease can
      // run either way against its fold line. The drape's surface is one mesh
      // across the fold: points just either side of the crease must stay a
      // material's breadth apart, not tear open.
      const crossCreaseGap = (start: Point, end: Point) => {
        const group = runBuilder({
          patternPieces: [piece],
          pieceMeshes: [pieceMesh],
          mode: 'assembled',
          foldLines: [foldLine({ angleDeg: 90, radiusMm: 6, start, end })],
        }).assembledGroup
        const samples = drapeSamples(group)
        const above = samples.filter((sample) => sample.document.y > 20.5 && sample.document.y < 26)
        const below = samples.filter((sample) => sample.document.y < 19.5 && sample.document.y > 14)
        expect(above.length).toBeGreaterThan(0)
        expect(below.length).toBeGreaterThan(0)
        let nearest = Number.POSITIVE_INFINITY
        for (const a of above) {
          for (const b of below) {
            nearest = Math.min(nearest, a.world.distanceTo(b.world))
          }
        }
        return nearest
      }

      const materialBreadth = 12 * TRANSFORM.scale
      expect(crossCreaseGap({ x: 0, y: 20 }, { x: 40, y: 20 })).toBeLessThan(materialBreadth)
      expect(crossCreaseGap({ x: 40, y: 20 }, { x: 0, y: 20 })).toBeLessThan(materialBreadth)
    })

    it('tints the drape by fold stress only when asked, and never the shared material', () => {
      const { piece, pieceMesh } = squarePiece()
      const drapeMeshes = (group: Group) => {
        const found: Mesh[] = []
        group.traverse((object) => {
          if (object instanceof Mesh && object.name === ASSEMBLED_DRAPE_MESH_NAME) {
            found.push(object as Mesh)
          }
        })
        return found
      }
      const build2 = (settings: Record<string, boolean>) =>
        runBuilder({
          patternPieces: [piece],
          pieceMeshes: [pieceMesh],
          mode: 'assembled',
          foldLines: [foldLine({ angleDeg: 90, radiusMm: 4 })],
          settings,
        })
      const build = (showFoldStressOverlay: boolean) =>
        runBuilder({
          patternPieces: [piece],
          pieceMeshes: [pieceMesh],
          mode: 'assembled',
          foldLines: [foldLine({ angleDeg: 90, radiusMm: 4 })],
          settings: { showFoldStressOverlay },
        })

      // Off is the default, and off has to mean the leather is drawn exactly
      // as it was before any of this existed.
      const plain = drapeMeshes(build(false).assembledGroup)
      expect(plain.length).toBeGreaterThan(0)
      for (const mesh of plain) {
        expect(mesh.geometry.getAttribute('color')).toBeUndefined()
      }

      const on = build(true)
      const tinted = drapeMeshes(on.assembledGroup).filter((mesh) => mesh.geometry.getAttribute('color'))
      expect(tinted.length).toBeGreaterThan(0)
      for (const mesh of tinted) {
        expect((mesh.material as Material).vertexColors).toBe(true)
        expect(mesh.material).not.toBe(on.materials.assembledFrontMaterial)
        expect(mesh.material).not.toBe(on.materials.assembledBackMaterial)
      }
      // The manager hands one material to every piece and keeps it across
      // rebuilds. Reading vertex colours is a different shader, so the overlay
      // has to take a copy — switch it on once and a mutated shared material
      // would tint every other piece, and go on tinting them after it is
      // switched off again.
      expect(on.materials.assembledFrontMaterial.vertexColors).toBe(false)
      expect(on.materials.assembledBackMaterial.vertexColors).toBe(false)

      // The clash overlay is its own switch on the same channel, and when both
      // are on the clash wins: a fold drawn through another piece is not a
      // picture whose stress reading means anything yet.
      const clash = build2({ showFoldClashOverlay: true })
      const clashed = drapeMeshes(clash.assembledGroup).filter((mesh) => mesh.geometry.getAttribute('color'))
      expect(clashed.length).toBeGreaterThan(0)
      const both = build2({ showFoldStressOverlay: true, showFoldClashOverlay: true })
      const bothTinted = drapeMeshes(both.assembledGroup).filter((mesh) => mesh.geometry.getAttribute('color'))
      expect(bothTinted.length).toBe(clashed.length)
      const clashColor = clashed[0].geometry.getAttribute('color')
      const bothColor = bothTinted[0].geometry.getAttribute('color')
      expect([...(bothColor.array as Float32Array)]).toEqual([...(clashColor.array as Float32Array)])
    })

    it('drapes over what is in its way whether or not it is sewn there', () => {
      const { piece, pieceMesh } = squarePiece()
      // Another piece parked where the flap lands. The analytic fold could
      // only clear what a seam told it about; the simulated fold collides
      // with the leather itself, so sewn or unsewn makes no difference.
      // The pocket covers only the base half, the way a card pocket does —
      // over the whole square it would also roof the flap's own leather in.
      const pocketOuter = [
        { x: 2, y: 22 },
        { x: 38, y: 22 },
        { x: 38, y: 38 },
        { x: 2, y: 38 },
      ]
      const pocket = {
        piece: { ...piece, id: 'piece-2', name: 'Pocket', boundaryShapeId: 'shape-2' },
        pieceMesh: {
          ...pieceMesh,
          pieceId: 'piece-2',
          name: 'Pocket',
          outer: pocketOuter,
          bounds: { minX: 2, minY: 22, maxX: 38, maxY: 38, width: 36, height: 16 },
          center: { x: 20, y: 30 },
          edges: pocketOuter.map((start, index) => {
            const end = pocketOuter[(index + 1) % pocketOuter.length]
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
      const onTopOfTheBase: PiecePlacement3D = {
        pieceId: 'piece-2',
        translationMm: { x: 0, y: 2, z: 0 },
        rotationDeg: { x: 0, y: 0, z: 0 },
        flipped: false,
      }
      const flapHigh = (withPocket: boolean, seamConnections: SeamConnection[]) => {
        const group = runBuilder({
          patternPieces: withPocket ? [piece, pocket.piece] : [piece],
          pieceMeshes: withPocket ? [pieceMesh, pocket.pieceMesh] : [pieceMesh],
          mode: 'assembled',
          // A mountain fold carries the flap up and over the base.
          foldLines: [foldLine({ angleDeg: 180, direction: 'mountain' })],
          seamConnections,
          piecePlacements3d: withPocket ? [onTopOfTheBase] : [],
        }).assembledGroup
        // The flap's deep end, read off the piece's own drape surface.
        const heights = drapeSamples(group)
          .filter((sample) => sample.document.y < 8)
          .map((sample) => sample.world.y)
        expect(heights.length).toBeGreaterThan(0)
        return Math.max(...heights)
      }

      const sewn: SeamConnection = {
        id: 'seam-1',
        from: { pieceId: 'piece-1', edgeIndex: 2 },
        to: { pieceId: 'piece-2', edgeIndex: 0 },
        kind: 'sewn',
      }
      const alone = flapHigh(false, [])
      const overUnsewnPocket = flapHigh(true, [])
      const overSewnPocket = flapHigh(true, [sewn])
      // The pocket lies a stock thickness above where the flap would
      // otherwise rest, so clearing it costs about one more thickness.
      expect(overUnsewnPocket - alone).toBeGreaterThan(1 * TRANSFORM.scale)
      expect(overUnsewnPocket - alone).toBeLessThan(4 * TRANSFORM.scale)
      // Sewing it changes nothing: the leather was already in the way.
      expect(Math.abs(overSewnPocket - overUnsewnPocket)).toBeLessThan(1.5 * TRANSFORM.scale)
    })

    it('draws no outline along a crease', () => {
      const { piece, pieceMesh } = squarePiece()
      // The crease is document y = 20, which is this transform's centre, so the
      // projection puts it on world z = 0.
      const onCrease = (z: number) => Math.abs(z) < 1e-6
      const outlineSegments = (foldLines: FoldLine[]) => {
        const group = runBuilder({ patternPieces: [piece], pieceMeshes: [pieceMesh], mode: 'assembled', foldLines }).assembledGroup
        const segments: Array<{ alongCrease: boolean }> = []
        group.traverse((object) => {
          if (!(object instanceof Line)) {
            return
          }
          const position = (object as Line).geometry.getAttribute('position') as BufferAttribute
          for (let index = 0; index + 1 < position.count; index += 2) {
            segments.push({ alongCrease: onCrease(position.getZ(index)) && onCrease(position.getZ(index + 1)) })
          }
        })
        return segments
      }

      // The square's four sides, once.
      expect(outlineSegments([])).toHaveLength(4)
      // Dialled flat the regions keep their own three cut sides and drop the
      // crease: six segments, not eight. Folded, the drape draws the outline
      // along the whole cut boundary at its own sampling; either way no
      // segment runs along the fold, because the leather was never cut there.
      expect(outlineSegments([foldLine({ angleDeg: 0 })])).toHaveLength(6)
      for (const angleDeg of [0, 90]) {
        const segments = outlineSegments([foldLine({ angleDeg })])
        expect(segments.length).toBeGreaterThan(0)
        expect(segments.some((segment) => segment.alongCrease)).toBe(false)
      }
    })

    it('keeps the seam picker in step with the folded geometry', () => {
      const { piece, pieceMesh } = squarePiece()
      const result = runBuilder({
        patternPieces: [piece],
        pieceMeshes: [pieceMesh],
        mode: 'assembled',
        foldLines: [foldLine({ angleDeg: 90 })],
      })

      const mapped: Array<{ x: number; y: number }> = []
      result.assembledGroup.updateMatrixWorld(true)
      result.assembledGroup.traverse((object) => {
        if (!(object instanceof Mesh)) {
          return
        }
        if (object.name === ASSEMBLED_DRAPE_MESH_NAME) {
          // Deformed geometry carries its document coordinates in uv1 — the
          // channel the picker reads — instead of being invertible by frame.
          const uvDocument = (object as Mesh).geometry.getAttribute('uv1')
          expect(uvDocument).toBeDefined()
          for (let index = 0; index < uvDocument.count; index += 1) {
            mapped.push({ x: uvDocument.getX(index), y: uvDocument.getY(index) })
          }
          return
        }
        const frame = pieceFrameForObject(object)
        expect(frame).not.toBeNull()
        const position = (object as Mesh).geometry.getAttribute('position')
        for (let index = 0; index < position.count; index += 1) {
          const world = new Vector3().fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld)
          mapped.push(worldPointToDocument(world, frame as Group, TRANSFORM))
        }
      })

      // Every vertex of the folded model maps back onto the 40mm square it was
      // cut from. Inverting the piece group instead of the region the hit
      // landed in lands them a centroid away, which is a seam picked on the
      // wrong edge.
      expect(mapped.length).toBeGreaterThan(0)
      for (const point of mapped) {
        expect(point.x).toBeGreaterThan(-1)
        expect(point.x).toBeLessThan(41)
        expect(point.y).toBeGreaterThan(-1)
        expect(point.y).toBeLessThan(41)
      }
    })

    it('carries the stitch holes on the folded half up with it', () => {
      const { piece, pieceMesh } = squarePiece()
      const holes: StitchHole[] = [
        { id: 'hole-1', shapeId: 'shape-1', point: { x: 20, y: 4 }, angleDeg: 0, holeType: 'round', sequence: 0 },
        { id: 'hole-2', shapeId: 'shape-1', point: { x: 20, y: 36 }, angleDeg: 0, holeType: 'round', sequence: 1 },
      ]
      const flat = runBuilder({
        patternPieces: [piece],
        pieceMeshes: [pieceMesh],
        mode: 'assembled',
        stitchHoles: holes,
      })
      const folded = runBuilder({
        patternPieces: [piece],
        pieceMeshes: [pieceMesh],
        mode: 'assembled',
        stitchHoles: holes,
        foldLines: [foldLine({ angleDeg: 90 })],
      })

      const holeHeight = (group: Group) => {
        const instanced = meshes(group).filter((mesh) => mesh instanceof InstancedMesh)
        expect(instanced.length).toBeGreaterThan(0)
        const box = new Box3()
        for (const mesh of instanced) {
          box.union(new Box3().setFromObject(mesh))
        }
        return box.max.y - box.min.y
      }

      // Flat, both holes sit on one plane. Folded, one of them has gone up with
      // the leather it is punched through.
      expect(holeHeight(flat.assembledGroup)).toBeLessThan(FLAT_HEIGHT)
      expect(holeHeight(folded.assembledGroup)).toBeGreaterThan(0.25)
    })
  })

  describe('edges', () => {
    const materialColors = (group: Group) =>
      meshes(group)
        .flatMap((mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]))
        .filter((material): material is MeshStandardMaterial => material instanceof MeshStandardMaterial)
        .map((material) => material.color.getHexString())

    it('leaves the shared side material alone when no edge finish is set', () => {
      const { piece, pieceMesh } = squarePiece()
      const materials = createMaterials()
      const result = runBuilder({ patternPieces: [piece], pieceMeshes: [pieceMesh], mode: 'assembled' })

      expect(materialColors(result.assembledGroup)).toContain(materials.assembledSideMaterial.color.getHexString())
    })

    it('paints the cut faces the chosen colour', () => {
      const { piece, pieceMesh } = squarePiece()
      const result = runBuilder({
        patternPieces: [{ ...piece, edgeFinish: { enabled: true, style: 'paint', color: '#ff0000' } }],
        pieceMeshes: [pieceMesh],
        mode: 'assembled',
      })

      expect(materialColors(result.assembledGroup)).toContain('ff0000')
    })

    it('darkens the cut faces with the piece colour when burnishing', () => {
      const { piece, pieceMesh } = squarePiece()
      const result = runBuilder({
        patternPieces: [{ ...piece, color: '#ffffff', edgeFinish: { enabled: true, style: 'burnish' } }],
        pieceMeshes: [pieceMesh],
        mode: 'assembled',
      })

      const burnished = materialColors(result.assembledGroup).filter((color) => color !== 'ffffff')
      expect(burnished.length).toBeGreaterThan(0)
      // White leather burnishes to a mid grey, not to white and not to black.
      expect(burnished).toContain('b3b3b3')
    })

    it('outlines each piece in its own highlight colour only when the highlight is on', () => {
      const { piece, pieceMesh } = squarePiece()
      const second = {
        piece: { ...piece, id: 'piece-2', name: 'Back Panel' },
        pieceMesh: { ...pieceMesh, pieceId: 'piece-2', name: 'Back Panel' },
      }
      const outlineColors = (group: Group) => {
        const colors: string[] = []
        group.traverse((object) => {
          if (object instanceof Line && object.material instanceof LineBasicMaterial) {
            colors.push(object.material.color.getHexString())
          }
        })
        return colors
      }
      const build = (settings?: Partial<ThreePreviewSettings>) =>
        outlineColors(
          runBuilder({
            patternPieces: [piece, second.piece],
            pieceMeshes: [pieceMesh, second.pieceMesh],
            mode: 'assembled',
            settings,
          }).assembledGroup,
        )

      // Off, both pieces draw the same neutral hairline.
      expect(new Set(build())).toEqual(new Set(['e2e8f0']))
      // On, the two pieces are told apart — which is the whole point, and is
      // why this does not use the pieces' own leather colours.
      const highlighted = build({ showPieceOutlines: true })
      expect(highlighted).toContain('38bdf8')
      expect(highlighted).toContain('f472b6')
    })
  })
})
