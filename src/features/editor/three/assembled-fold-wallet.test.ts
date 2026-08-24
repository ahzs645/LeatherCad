/**
 * The assembled fold, against the wallet the pipeline actually imports.
 *
 * The square fixture in `assembled-model-builder.test.ts` proves the geometry;
 * this proves it reaches a real document. The MAKESUPPLY sheet's creases are
 * inferred, not authored — they arrive with the piece they belong to, angles of
 * zero and coordinates a hundred millimetres from the origin — and every one of
 * those differences is a way for the bend to silently not be built.
 */

import { readFileSync } from 'node:fs'
import { Group, Material, Mesh, MeshStandardMaterial, DoubleSide, MeshBasicMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THREE_PREVIEW_SETTINGS } from '../editor-constants'
import { parseImportedJsonDocument } from '../editor-json-import'
import { detectOutlines } from '../ops/outline-detection'
import { buildModelLayout } from './model-builder'
import { ASSEMBLED_DRAPE_MESH_NAME, rebuildAssembledModel, wrappedThicknessMm } from './assembled-model-builder'
import { minimumBendRadiusMm } from './assembled-fold-bend'
import { solveFoldDrapeData } from './assembled-fold-drape'
import { createFoldDrapeStore, type FoldDrapeStore } from './fold-drape-store'
import { splitPieceByFolds } from './assembled-fold-regions'
import type { ModelBuilderMaterials } from './model-builder-types'
import type { OutlinePolygon } from './three-bridge-types'

const DOC_PATH = 'docs/fixtures/pattern-pdf/makesupply-keychain-snap-wallet.doc.json'

function materials(): ModelBuilderMaterials {
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

function loadWallet() {
  return parseImportedJsonDocument(readFileSync(DOC_PATH, 'utf8')).doc
}

function buildWallet(foldAngleDeg: number, foldDrape?: FoldDrapeStore) {
  const doc = loadWallet()
  const foldLines = doc.foldLines.map((foldLine) => ({ ...foldLine, angleDeg: foldAngleDeg }))
  const { pieceMeshes, transform, documentBounds } = buildModelLayout({
    patternPieces: doc.patternPieces ?? [],
    outlinePolygons: outlinePolygons(doc),
    shapes: doc.objects,
    foldLines,
  })
  const assembledGroup = new Group()

  rebuildAssembledModel({
    layers: doc.layers,
    lineTypes: doc.lineTypes,
    shapes: doc.objects,
    foldLines,
    stitchHoles: doc.stitchHoles ?? [],
    outlinePolygons: [],
    patternPieces: doc.patternPieces ?? [],
    piecePlacements3d: doc.piecePlacements3d ?? [],
    seamConnections: doc.seamConnections ?? [],
    previewSettings: { ...DEFAULT_THREE_PREVIEW_SETTINGS, ...doc.threePreviewSettings, mode: 'assembled' },
    pieceMeshes,
    transform,
    documentBounds,
    threadColor: '#fb923c',
    texturedShapeIdSet: new Set(),
    hasActiveTexture: false,
    materials: materials(),
    preservedMaterials: new Set<Material>(),
    fitControlsToModel: () => undefined,
    assembledGroup,
    finalProductGroup: new Group(),
    staticSideGroup: new Group(),
    foldingSideGroup: new Group(),
    foldGuideGroup: new Group(),
    avatarGroup: new Group(),
    rebuildAvatarModel: async () => undefined,
    foldDrape,
  })

  return assembledGroup
}

/** The closed outlines the 3D view derives its piece meshes from. */
function outlinePolygons(doc: ReturnType<typeof loadWallet>): OutlinePolygon[] {
  const result: OutlinePolygon[] = []
  for (const chain of detectOutlines(doc.objects, doc.lineTypes)) {
    if (!chain.isClosed || chain.area < 1) continue
    const firstShape = doc.objects.find((shape) => shape.id === chain.shapeIds[0])
    if (!firstShape) continue
    result.push({
      polygon: chain.polygon,
      shapeIds: chain.shapeIds,
      segments: chain.segments,
      layerId: firstShape.layerId,
    })
  }
  return result
}

/** Meshes built by the bend: the only double-sided surfaces in an assembled piece. */
function bendMeshes(group: Group) {
  const found: Mesh[] = []
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const material = (object as Mesh).material
    if (material instanceof MeshStandardMaterial || material instanceof MeshBasicMaterial) {
      if (material.side === DoubleSide) found.push(object as Mesh)
    }
  })
  return found
}

/** Leather drawn by the fold drape rather than by the rigid region path. */
function drapeMeshes(group: Group) {
  const found: string[] = []
  group.traverse((object) => {
    if (object instanceof Mesh && object.name === ASSEMBLED_DRAPE_MESH_NAME) found.push(object.name)
  })
  return found
}

describe('the imported wallet folds', () => {
  it('has creases attributed to its pieces', () => {
    const doc = loadWallet()
    expect(doc.foldLines.length).toBeGreaterThan(0)
    for (const foldLine of doc.foldLines) {
      expect((doc.patternPieces ?? []).some((piece) => piece.id === foldLine.pieceId)).toBe(true)
    }
  })

  it('splits the body into a flap and a base', () => {
    // Two pieces are creased, so the three pieces render as five regions.
    const regions: string[] = []
    buildWallet(90).traverse((object) => {
      if (object.name.startsWith('assembled-region-')) regions.push(object.name)
    })
    expect(regions.length).toBeGreaterThan(3)
  })

  it('wraps each crease in leather once the fold is dialled up', () => {
    expect(bendMeshes(buildWallet(0))).toHaveLength(0)
    expect(bendMeshes(buildWallet(90)).length).toBeGreaterThan(0)
  })

  it('draws the rigid fold until the deferred drape lands, then the drape', async () => {
    // What a scrub looks like from the renderer's side. The solve is not on
    // this thread in the app, so a rebuild cannot wait for it: the first pass
    // draws the analytic fold, the drape swaps in when it settles, and a
    // rebuild at an angle already solved costs nothing.
    const solvedPieces: string[] = []
    let settled = 0
    const store = createFoldDrapeStore({
      solver: {
        solve: async (pieceId, params) => {
          solvedPieces.push(pieceId)
          return solveFoldDrapeData(params)
        },
        dispose: () => undefined,
      },
      onSettled: () => {
        settled += 1
      },
    })

    expect(drapeMeshes(buildWallet(180, store))).toHaveLength(0)
    expect(solvedPieces.length).toBeGreaterThan(0)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(settled).toBe(solvedPieces.length)

    const asked = solvedPieces.length
    expect(drapeMeshes(buildWallet(180, store)).length).toBeGreaterThan(0)
    // The second rebuild is answered from the cache: same angles, same
    // leather, no solve.
    expect(solvedPieces).toHaveLength(asked)
    store.dispose()
  })

  it('renders its dialled folds from the simulated drape, not the rigid halves', () => {
    // Flat there is nothing to simulate; folded, every creased piece's
    // leather comes from the settled cloth — the imported document exercises
    // the whole pipeline: real outlines, inferred creases, other pieces as
    // rigid bodies in the fold's way.
    expect(drapeMeshes(buildWallet(0))).toHaveLength(0)
    expect(drapeMeshes(buildWallet(180)).length).toBeGreaterThan(0)
  })

  it('closes the flap over the card pocket rather than through it', () => {
    const doc = loadWallet()
    const thicknessMm = doc.threePreviewSettings?.thicknessMm ?? DEFAULT_THREE_PREVIEW_SETTINGS.thicknessMm
    const { pieceMeshes, transform } = buildModelLayout({
      patternPieces: doc.patternPieces ?? [],
      outlinePolygons: outlinePolygons(doc),
      shapes: doc.objects,
      foldLines: doc.foldLines,
    })
    const pieceMeshById = new Map(pieceMeshes.map((mesh) => [mesh.pieceId, mesh]))
    const body = doc.foldLines.find((foldLine) => foldLine.pieceId === 'piece-a')
    expect(body).toBeDefined()

    const regions = splitPieceByFolds(pieceMeshById.get('piece-a')!.outer, [body!])
    const flap = regions.find((region) => region.hinges.length > 0)
    expect(flap).toBeDefined()

    const wrapped = wrappedThicknessMm({
      region: flap!,
      pieceId: 'piece-a',
      seamConnections: doc.seamConnections ?? [],
      pieceMeshById,
      materialThicknessMm: thicknessMm,
    })
    // The card slot panel is sewn to the body's base, so the flap folds over it.
    expect(wrapped).toBeCloseTo(thicknessMm, 6)

    // Closed, the fold has to hold the body's own thickness plus the pocket's.
    const needed = minimumBendRadiusMm(thicknessMm / 2, wrapped)
    expect(needed).toBeCloseTo(thicknessMm, 6)
    expect(2 * needed).toBeGreaterThanOrEqual(2 * thicknessMm)
    expect(transform.scale).toBeGreaterThan(0)
  })
})
