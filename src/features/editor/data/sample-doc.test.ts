import { Group, Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THREE_PREVIEW_SETTINGS } from '../editor-constants'
import { sampleShapePoints } from '../cad/cad-geometry'
import type { DocFile } from '../cad/cad-types'
import { buildModelLayout, rebuildFoldModel } from '../three/model-builder'
import { buildFinalProductPanelGraph } from '../three/final-product-panel-graph'
import { buildFinalProductRegions } from '../three/final-product-regions'
import { solveFinalProduct } from '../three/final-product-solver'
import { ThreeFoldManager } from '../three/fold-manager'
import { PRESET_DOCS } from './sample-doc'

function walletDoc() {
  const preset = PRESET_DOCS.find((entry) => entry.id === 'wallet')
  expect(preset).toBeDefined()
  return preset!.doc
}

function boundsForPrefix(doc: DocFile, idPrefix: string) {
  const points = doc.objects
    .filter((shape) => shape.id.startsWith(idPrefix))
    .flatMap((shape) => sampleShapePoints(shape, shape.type === 'line' ? 1 : 20))

  expect(points.length).toBeGreaterThan(0)

  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}

function width(bounds: ReturnType<typeof boundsForPrefix>) {
  return bounds.maxX - bounds.minX
}

function height(bounds: ReturnType<typeof boundsForPrefix>) {
  return bounds.maxY - bounds.minY
}

function regionBounds(region: { polygon: Array<{ x: number; y: number }> }) {
  return {
    minX: Math.min(...region.polygon.map((point) => point.x)),
    maxX: Math.max(...region.polygon.map((point) => point.x)),
    minY: Math.min(...region.polygon.map((point) => point.y)),
    maxY: Math.max(...region.polygon.map((point) => point.y)),
  }
}

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

function hasMesh(group: Group) {
  return group.children.some((child) => child instanceof Mesh)
}

describe('wallet preset', () => {
  it('is sized for bills and ID-1 cards', () => {
    const doc = walletDoc()

    const shellBounds = boundsForPrefix(doc, 'wallet-shell-outline')
    expect(width(shellBounds)).toBeCloseTo(232)
    expect(height(shellBounds)).toBeCloseTo(96)

    const billClearanceBounds = boundsForPrefix(doc, 'wallet-bill-clearance-reference')
    expect(width(billClearanceBounds)).toBeCloseTo(156)
    expect(height(billClearanceBounds)).toBeCloseTo(72)

    const leftCardBounds = boundsForPrefix(doc, 'wallet-left-card-clearance-reference')
    const rightCardBounds = boundsForPrefix(doc, 'wallet-right-card-clearance-reference')
    expect(width(leftCardBounds)).toBeCloseTo(85.6)
    expect(height(leftCardBounds)).toBeCloseTo(54)
    expect(width(rightCardBounds)).toBeCloseTo(85.6)
    expect(height(rightCardBounds)).toBeCloseTo(54)
  })

  it('keeps card pocket panels clear of the center fold and hinges the shell plus bill liner', () => {
    const doc = walletDoc()
    const regions = buildFinalProductRegions({
      layers: doc.layers,
      lineTypes: doc.lineTypes,
      shapes: doc.objects,
      outlinePolygons: [],
    })

    const leftPocketRegions = regions.filter((region) => region.layerId === 'wallet-left-pocket')
    const rightPocketRegions = regions.filter((region) => region.layerId === 'wallet-right-pocket')

    expect(leftPocketRegions.length).toBeGreaterThan(0)
    expect(rightPocketRegions.length).toBeGreaterThan(0)
    expect(leftPocketRegions.every((region) => regionBounds(region).maxX <= -8)).toBe(true)
    expect(rightPocketRegions.every((region) => regionBounds(region).minX >= 8)).toBe(true)

    const graph = buildFinalProductPanelGraph({
      foldLines: doc.foldLines,
      regions,
      documentBounds: boundsForPrefix(doc, 'wallet-shell-outline'),
    })

    expect(graph.hinges).toHaveLength(2)
    expect(graph.diagnostics.filter((diagnostic) => diagnostic.code === 'fold-line-unresolved')).toHaveLength(0)

    const result = solveFinalProduct({
      foldLines: doc.foldLines,
      stitchHoles: doc.stitchHoles ?? [],
      regions,
      documentBounds: boundsForPrefix(doc, 'wallet-shell-outline'),
      thicknessMm: 1.8,
    })
    expect(result.collisionWarningCount).toBe(0)
  })

  it('builds visible static and folding panels in the 3D fold preview', () => {
    const doc = walletDoc()
    const { pieceMeshes, transform, documentBounds } = buildModelLayout({
      patternPieces: doc.patternPieces ?? [],
      outlinePolygons: [],
      shapes: doc.objects,
      foldLines: doc.foldLines,
    })

    const staticSideGroup = new Group()
    const foldingSideGroup = new Group()
    const foldGuideGroup = new Group()
    const foldManager = new ThreeFoldManager()

    rebuildFoldModel({
      layers: doc.layers,
      lineTypes: doc.lineTypes,
      shapes: doc.objects,
      foldLines: doc.foldLines,
      stitchHoles: doc.stitchHoles ?? [],
      outlinePolygons: [],
      patternPieces: doc.patternPieces ?? [],
      piecePlacements3d: doc.piecePlacements3d ?? [],
      seamConnections: doc.seamConnections ?? [],
      previewSettings: DEFAULT_THREE_PREVIEW_SETTINGS,
      pieceMeshes,
      transform,
      documentBounds,
      threadColor: '#f97316',
      texturedShapeIdSet: new Set(),
      hasActiveTexture: false,
      materials: createMaterials(),
      preservedMaterials: new Set(),
      fitControlsToModel: () => undefined,
      staticSideGroup,
      foldingSideGroup,
      foldGuideGroup,
      assembledGroup: new Group(),
      finalProductGroup: new Group(),
      avatarGroup: new Group(),
      foldingPivot: new Group(),
      modelRoot: new Group(),
      foldManager,
    })

    expect(hasMesh(staticSideGroup)).toBe(true)
    expect(hasMesh(foldingSideGroup)).toBe(true)
    expect(foldGuideGroup.children).toHaveLength(1)
  })
})
