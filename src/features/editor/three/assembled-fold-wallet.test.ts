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
import { rebuildAssembledModel } from './assembled-model-builder'
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

function buildWallet(foldAngleDeg: number) {
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
})
