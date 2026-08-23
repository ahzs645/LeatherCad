import { Box3, BufferAttribute, DoubleSide, Group, InstancedMesh, Line, LineBasicMaterial, Material, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { FoldLine, Layer, PatternPiece, Point, SeamConnection, StitchHole, ThreePreviewSettings } from '../cad/cad-types'
import type { PieceMeshData } from './piece-mesh'
import { ThreeAvatarManager } from './avatar-manager'
import { rebuildAssembledModel } from './assembled-model-builder'
import { ASSEMBLED_REGION_GROUP_PREFIX } from './assembled-model-builder'
import { pieceFrameForObject, worldPointToDocument } from './seam-edge-picking'

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
  settings,
}: {
  patternPieces: PatternPiece[]
  pieceMeshes: PieceMeshData[]
  mode: ThreePreviewSettings['mode']
  foldLines?: FoldLine[]
  stitchHoles?: StitchHole[]
  seamConnections?: SeamConnection[]
  settings?: Partial<ThreePreviewSettings>
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
    piecePlacements3d: [],
    seamConnections,
    previewSettings: previewSettings({ mode, ...settings }),
    pieceMeshes,
    transform: TRANSFORM,
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

    it('turns the bend about a centre a radius off the surface', () => {
      const { piece, pieceMesh } = squarePiece()
      const bendRadiusMm = 3
      const group = runBuilder({
        patternPieces: [piece],
        pieceMeshes: [pieceMesh],
        mode: 'assembled',
        foldLines: [foldLine({ angleDeg: 90, radiusMm: bendRadiusMm })],
      }).assembledGroup

      const halfThickness = (2 * TRANSFORM.scale) / 2
      const radius = bendRadiusMm * TRANSFORM.scale
      const distances: number[] = []
      group.traverse((object) => {
        if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) {
          return
        }
        const position = (object as Mesh).geometry.getAttribute('position')
        if (object.material.side !== DoubleSide || position.count === 0) {
          return
        }
        for (let index = 0; index < position.count; index += 1) {
          const point = new Vector3().fromBufferAttribute(position, index)
          // The crease runs along document y = 20, which the projection puts on
          // world (y, z) = (0, 0); a valley fold turns about a centre one radius
          // below it.
          distances.push(Math.hypot(point.y + radius, point.z))
        }
      })

      expect(distances.length).toBeGreaterThan(0)
      // Every bend vertex is on the inner surface, the outer surface, or the
      // cut cross-section that spans them.
      for (const distance of distances) {
        expect(distance).toBeGreaterThanOrEqual(radius - halfThickness - 1e-6)
        expect(distance).toBeLessThanOrEqual(radius + halfThickness + 1e-6)
      }
      expect(Math.max(...distances)).toBeCloseTo(radius + halfThickness, 6)
      expect(Math.min(...distances)).toBeCloseTo(radius - halfThickness, 6)
    })

    it('joins the bend to both halves, whichever way the crease edge runs', () => {
      const { piece, pieceMesh } = squarePiece()
      // The region's boundary winds however the clip left it, so a crease edge
      // can run either way against its fold line. The bend has to land on the
      // leather in both cases; swept about the reversed axis it curves off into
      // space and the halves are drawn unjoined.
      const bendToSwingingHalf = (start: Point, end: Point) => {
        const group = runBuilder({
          patternPieces: [piece],
          pieceMeshes: [pieceMesh],
          mode: 'assembled',
          foldLines: [foldLine({ angleDeg: 90, radiusMm: 6, start, end })],
        }).assembledGroup

        const bend: Vector3[] = []
        const swingingSlab: Vector3[] = []
        group.traverse((object) => {
          if (!(object instanceof Mesh)) {
            return
          }
          // The bend is the only double-sided surface. The slab it has to reach
          // is the extruded body inside the region group the hinge created —
          // that one carries a material per face group, so it comes as an array.
          const material = (object as Mesh).material
          const isBend = material instanceof MeshStandardMaterial && material.side === DoubleSide
          const onSwingingHalf = pieceFrameForObject(object)?.name === `${ASSEMBLED_REGION_GROUP_PREFIX}fold-1`
          const into = isBend ? bend : onSwingingHalf && Array.isArray(material) ? swingingSlab : null
          if (!into) {
            return
          }
          const position = (object as Mesh).geometry.getAttribute('position')
          for (let index = 0; index < position.count; index += 1) {
            into.push(new Vector3().fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld))
          }
        })
        expect(bend.length).toBeGreaterThan(0)
        expect(swingingSlab.length).toBeGreaterThan(0)

        // The arc ends exactly on the swinging half's own crease face, so the
        // closest the two ever come is zero. A bend swept the wrong way never
        // reaches it at all.
        let nearest = Number.POSITIVE_INFINITY
        for (const point of bend) {
          for (const other of swingingSlab) {
            nearest = Math.min(nearest, point.distanceTo(other))
          }
        }
        return nearest
      }

      expect(bendToSwingingHalf({ x: 0, y: 20 }, { x: 40, y: 20 })).toBeLessThan(1e-6)
      expect(bendToSwingingHalf({ x: 40, y: 20 }, { x: 0, y: 20 })).toBeLessThan(1e-6)
    })

    it('closes over what is sewn under it instead of through it', () => {
      const { piece, pieceMesh } = squarePiece()
      // A pocket sewn to the half that stays: the fold has to clear it.
      const pocket = {
        piece: { ...piece, id: 'piece-2', name: 'Pocket', boundaryShapeId: 'shape-2' },
        pieceMesh: { ...pieceMesh, pieceId: 'piece-2', name: 'Pocket' },
      }
      // The crease is y = 20 and the larger-area half stays, so y > 20 is the
      // half that stays put. Edge 2 runs along y = 40, on that half — a pocket
      // sewn there is inside the fold when it closes.
      const onTheHalfThatStays: SeamConnection = {
        id: 'seam-1',
        from: { pieceId: 'piece-1', edgeIndex: 2 },
        to: { pieceId: 'piece-2', edgeIndex: 0 },
        kind: 'sewn',
      }
      // Edge 0 runs along y = 0, on the half that swings: a pocket sewn there
      // travels with the flap and is not something the fold closes over.
      const onTheHalfThatSwings: SeamConnection = {
        ...onTheHalfThatStays,
        id: 'seam-2',
        from: { pieceId: 'piece-1', edgeIndex: 0 },
      }
      const lowestFoldedY = (seamConnections: SeamConnection[]) =>
        new Box3()
          .setFromObject(
            runBuilder({
              patternPieces: [piece, pocket.piece],
              pieceMeshes: [pieceMesh, pocket.pieceMesh],
              mode: 'assembled',
              foldLines: [foldLine({ angleDeg: 180 })],
              seamConnections,
            }).assembledGroup,
          )
          .min.y

      // Folded flat on itself the flap stands off by its own thickness; folded
      // over a pocket it stands off by that pocket as well, so the closed fold
      // reaches exactly one more stock thickness — 2mm at this scale.
      expect(lowestFoldedY([]) - lowestFoldedY([onTheHalfThatStays])).toBeCloseTo(2 * TRANSFORM.scale, 6)
      expect(lowestFoldedY([onTheHalfThatSwings])).toBeCloseTo(lowestFoldedY([]), 6)
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
      // Halved, each region keeps its own three cut sides and drops the crease:
      // six segments, not eight, and none of them along the fold.
      for (const angleDeg of [0, 90]) {
        const segments = outlineSegments([foldLine({ angleDeg })])
        expect(segments).toHaveLength(6)
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
      result.assembledGroup.traverse((object) => {
        if (!(object instanceof Mesh)) {
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
