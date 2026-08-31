import { Group, Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THREE_PREVIEW_SETTINGS } from '../editor-constants'
import { sampleShapePoints } from '../cad/cad-geometry'
import type { DocFile } from '../cad/cad-types'
import { buildModelLayout, rebuildFoldModel } from '../three/model-builder'
import { buildFinalProductPanelGraph } from '../three/final-product-panel-graph'
import { analyzeFinalProductFoldSweep } from '../three/final-product-fold-sweep'
import { rebuildFinalProductModel } from '../three/final-product-model-builder'
import { buildFinalProductRegions } from '../three/final-product-regions'
import { solveFinalProduct, solvePanelPoint } from '../three/final-product-solver'
import { ThreeFoldManager } from '../three/fold-manager'
import { PRESET_DOCS } from './sample-doc'
import { createSharedMaterials } from '../three/shared-materials'

function walletDoc() {
  const preset = PRESET_DOCS.find((entry) => entry.id === 'wallet')
  expect(preset).toBeDefined()
  return preset!.doc
}

function compactClaspWalletDoc() {
  const preset = PRESET_DOCS.find((entry) => entry.id === 'compact-clasp-wallet')
  expect(preset).toBeDefined()
  return preset!.doc
}

function trifoldWalletDoc() {
  const preset = PRESET_DOCS.find((entry) => entry.id === 'trifold')
  expect(preset).toBeDefined()
  return preset!.doc
}

function foldingBoxNetDoc() {
  const preset = PRESET_DOCS.find((entry) => entry.id === 'folding-box-net')
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

describe('compact clasp wallet preset', () => {
  it('loads a layered compact wallet pattern with money, middle card, outside card, and clasp layers', () => {
    const doc = compactClaspWalletDoc()
    const layerIds = doc.layers.map((layer) => layer.id)

    expect(layerIds).toContain('compact-shell')
    expect(layerIds).toContain('compact-money')
    expect(layerIds).toContain('compact-middle-card')
    expect(layerIds).toContain('compact-outside-card')
    expect(layerIds).toContain('compact-clasp')
    expect(layerIds).toContain('compact-guides')

    expect(doc.objects.some((shape) => shape.id.startsWith('compact-clasp-wallet-money-'))).toBe(true)
    expect(doc.objects.some((shape) => shape.id.startsWith('compact-clasp-wallet-middle-card-'))).toBe(true)
    expect(doc.objects.some((shape) => shape.id.startsWith('compact-clasp-wallet-outside-card-'))).toBe(true)
  })

  it('includes aligned clasp snap hardware and wallet-sized card and cash guides', () => {
    const doc = compactClaspWalletDoc()
    const hardwareMarkers = doc.hardwareMarkers ?? []

    expect(hardwareMarkers).toHaveLength(2)
    expect(hardwareMarkers.map((marker) => marker.label)).toEqual(['Flap snap cap', 'Body snap socket'])
    expect(hardwareMarkers.every((marker) => marker.kind === 'snap')).toBe(true)
    expect(hardwareMarkers.every((marker) => !marker.notes || marker.notes.trim().length === 0)).toBe(true)
    expect(hardwareMarkers[0].point.x).toBeCloseTo(hardwareMarkers[1].point.x)

    const frontCardBounds = boundsForPrefix(doc, 'compact-clasp-wallet-card-clearance-front')
    const middleCardBounds = boundsForPrefix(doc, 'compact-clasp-wallet-card-clearance-middle')
    const cashBounds = boundsForPrefix(doc, 'compact-clasp-wallet-folded-cash-clearance')

    expect(width(frontCardBounds)).toBeCloseTo(85.6)
    expect(height(frontCardBounds)).toBeCloseTo(54)
    expect(width(middleCardBounds)).toBeCloseTo(85.6)
    expect(height(middleCardBounds)).toBeCloseTo(54)
    expect(width(cashBounds)).toBeCloseTo(78)
    expect(height(cashBounds)).toBeCloseTo(78)
  })

  it('has a rounded flap fold and front pocket flex crease for preview debugging', () => {
    const doc = compactClaspWalletDoc()

    expect(doc.foldLines.map((fold) => fold.name)).toEqual([
      'Rounded Clasp Flap Fold',
      'Front Pocket Flex Crease',
    ])
    expect(doc.foldLines[0].start.y).toBeCloseTo(-50)
    expect(doc.foldLines[1].start.y).toBeCloseTo(52)
  })

  it('keeps labels outside the pocket stack and uses heavier preset strokes', () => {
    const doc = compactClaspWalletDoc()
    const textShapes = doc.objects.filter((shape) => shape.type === 'text')
    const drawableShapes = doc.objects.filter((shape) => shape.type !== 'text')

    expect(textShapes.length).toBeGreaterThan(0)
    expect(textShapes.every((shape) => shape.type === 'text' && shape.start.x >= 58)).toBe(true)
    expect(textShapes.every((shape) => shape.type === 'text' && shape.fontSizeMm >= 12)).toBe(true)
    expect(drawableShapes.every((shape) => 'strokeWidthOverride' in shape)).toBe(true)
  })
})

describe('trifold wallet prototype preset', () => {
  it('models a three-panel trifold wallet with bill and card-holder geometry', () => {
    const doc = trifoldWalletDoc()
    const layerIds = doc.layers.map((layer) => layer.id)

    expect(layerIds).toEqual([
      'trifold-shell',
      'trifold-clearance-guides',
      'trifold-bill-pocket',
      'trifold-inner-card-pocket',
      'trifold-front-card-pocket',
    ])
    expect(doc.objects.some((shape) => shape.id.startsWith('trifold-bill-liner-outline'))).toBe(true)
    expect(doc.objects.some((shape) => shape.id.startsWith('trifold-inner-card-slot-mouth'))).toBe(true)
    expect(doc.objects.some((shape) => shape.id.startsWith('trifold-front-card-slot-mouth'))).toBe(true)

    const shellBounds = boundsForPrefix(doc, 'trifold-shell-outline')
    expect(width(shellBounds)).toBeCloseTo(252)
    expect(height(shellBounds)).toBeCloseTo(100)

    const unfoldedBillBounds = boundsForPrefix(doc, 'trifold-unfolded-bill-clearance')
    const foldedBillBounds = boundsForPrefix(doc, 'trifold-folded-bill-clearance')
    const innerCardBounds = boundsForPrefix(doc, 'trifold-inner-card-clearance')
    const frontCardBounds = boundsForPrefix(doc, 'trifold-front-card-clearance')
    expect(width(unfoldedBillBounds)).toBeCloseTo(156)
    expect(height(unfoldedBillBounds)).toBeCloseTo(70)
    expect(width(foldedBillBounds)).toBeCloseTo(74)
    expect(height(foldedBillBounds)).toBeCloseTo(70)
    expect(innerCardBounds.maxX).toBeLessThan(-42)
    expect(frontCardBounds.minX).toBeGreaterThan(42)
  })

  it('authores sequential final-fold controls for the two trifold crease lines', () => {
    const doc = trifoldWalletDoc()

    expect(doc.foldLines.map((fold) => fold.name)).toEqual([
      'Left Wing Over Center',
      'Right Wing Over Stack',
    ])
    expect(doc.foldLines.map((fold) => fold.start.x)).toEqual([-42, 42])
    expect(doc.threePreviewSettings?.mode).toBe('final')
    expect(doc.threePreviewSettings?.foldTimeline?.map((step) => step.label)).toEqual([
      'Fold right wing over center',
      'Wrap left wing over stack',
    ])
    expect(doc.threePreviewSettings?.foldTimeline?.flatMap((step) => step.commands ?? []).map((command) => command.foldLineId)).toEqual([
      'trifold-tri-fold-right',
      'trifold-tri-fold-left',
    ])
  })

  it('compiles the trifold wallet into hinged thick-panel final-product geometry', () => {
    const doc = trifoldWalletDoc()
    const regions = buildFinalProductRegions({
      layers: doc.layers,
      lineTypes: doc.lineTypes,
      shapes: doc.objects,
      outlinePolygons: [],
    })
    const graph = buildFinalProductPanelGraph({
      foldLines: doc.foldLines,
      regions,
      documentBounds: boundsForPrefix(doc, 'trifold-shell-outline'),
    })

    expect(regions.filter((region) => region.layerId === 'trifold-shell')).toHaveLength(1)
    expect(regions.filter((region) => region.layerId === 'trifold-bill-pocket')).toHaveLength(1)
    expect(regions.filter((region) => region.layerId === 'trifold-inner-card-pocket').every((region) => regionBounds(region).maxX < -42)).toBe(true)
    expect(regions.filter((region) => region.layerId === 'trifold-front-card-pocket').every((region) => regionBounds(region).minX > 42)).toBe(true)
    expect(graph.hinges.length).toBeGreaterThanOrEqual(4)
    expect(graph.diagnostics.filter((diagnostic) => diagnostic.code === 'fold-line-unresolved')).toHaveLength(0)

    const { pieceMeshes, transform, documentBounds } = buildModelLayout({
      patternPieces: doc.patternPieces ?? [],
      outlinePolygons: [],
      shapes: doc.objects,
      foldLines: doc.foldLines,
    })
    const finalProductGroup = new Group()
    const result = rebuildFinalProductModel({
      layers: doc.layers,
      lineTypes: doc.lineTypes,
      shapes: doc.objects,
      foldLines: doc.foldLines,
      stitchHoles: doc.stitchHoles ?? [],
      outlinePolygons: [],
      patternPieces: doc.patternPieces ?? [],
      piecePlacements3d: doc.piecePlacements3d ?? [],
      seamConnections: doc.seamConnections ?? [],
      previewSettings: doc.threePreviewSettings ?? { ...DEFAULT_THREE_PREVIEW_SETTINGS, mode: 'final' },
      pieceMeshes,
      transform,
      documentBounds,
      threadColor: '#f97316',
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

    expect(result.panels.length).toBeGreaterThanOrEqual(7)
    expect(result.hinges.length).toBeGreaterThanOrEqual(4)
    expect(hasMesh(finalProductGroup)).toBe(true)
    expect(finalProductGroup.children.filter((child) => child.name.startsWith('final-product-panel-')).length).toBeGreaterThanOrEqual(7)
    expect(finalProductGroup.children.some((child) => child.name.startsWith('final-product-edge-finish-'))).toBe(true)
    expect(finalProductGroup.children.some((child) => child.name.startsWith('final-product-edge-roundover-'))).toBe(false)
    expect(finalProductGroup.children.some((child) => child.name.startsWith('final-product-fold-area-'))).toBe(true)
    expect(finalProductGroup.children.some((child) => child.name.startsWith('final-product-fold-band-'))).toBe(true)
  })

  it('passes a full fold-progress clearance sweep from flat to closed', () => {
    const doc = trifoldWalletDoc()
    const regions = buildFinalProductRegions({
      layers: doc.layers,
      lineTypes: doc.lineTypes,
      shapes: doc.objects,
      outlinePolygons: [],
    })
    const sweep = analyzeFinalProductFoldSweep({
      foldLines: doc.foldLines,
      instructions: doc.threePreviewSettings?.foldTimeline,
      stitchHoles: doc.stitchHoles ?? [],
      regions,
      outlinePolygons: [],
      documentBounds: boundsForPrefix(doc, 'trifold-shell-outline'),
      thicknessMm: doc.threePreviewSettings?.thicknessMm ?? 1.4,
      sampleCount: 21,
    })

    expect(sweep.sampleCount).toBe(21)
    expect(sweep.collisionCount).toBe(0)
    expect(sweep.diagnostics).toHaveLength(0)
  })
})

describe('open box tray net preset', () => {
  it('models a connected rigid-panel tray net with equal-height wall folds', () => {
    const doc = foldingBoxNetDoc()

    expect(doc.layers.map((layer) => layer.id)).toEqual(['folding-box-net', 'folding-box-guides'])
    expect(doc.foldLines).toHaveLength(4)
    expect(doc.foldLines.filter((fold) => fold.angleDeg === 90)).toHaveLength(4)
    expect(doc.foldLines.filter((fold) => fold.angleDeg === 90).every((fold) => fold.direction === 'valley')).toBe(true)
    expect(doc.objects.some((shape) => shape.id.startsWith('folding-box-net-box-base-outline'))).toBe(true)
    expect(doc.objects.some((shape) => shape.id.startsWith('folding-box-net-box-back-flap-outline'))).toBe(false)
    const backBounds = boundsForPrefix(doc, 'folding-box-net-box-back-wall-outline')
    const leftBounds = boundsForPrefix(doc, 'folding-box-net-box-left-wall-outline')
    expect(backBounds.maxY - backBounds.minY).toBeCloseTo(leftBounds.maxX - leftBounds.minX)
  })

  it('compiles the box net into hinged final-product panels without unresolved fold axes', () => {
    const doc = foldingBoxNetDoc()
    const regions = buildFinalProductRegions({
      layers: doc.layers,
      lineTypes: doc.lineTypes,
      shapes: doc.objects,
      outlinePolygons: [],
    })
    const graph = buildFinalProductPanelGraph({
      foldLines: doc.foldLines,
      regions,
      documentBounds: boundsForPrefix(doc, 'folding-box-net-box-base-outline'),
    })

    expect(regions).toHaveLength(1)
    expect(graph.panels.length).toBe(5)
    expect(graph.hinges).toHaveLength(4)
    expect(graph.diagnostics.filter((diagnostic) => diagnostic.code === 'fold-line-unresolved')).toHaveLength(0)
  })

  it('renders a folded final-product preview mesh for the connected box net', () => {
    const doc = foldingBoxNetDoc()
    const regions = buildFinalProductRegions({
      layers: doc.layers,
      lineTypes: doc.lineTypes,
      shapes: doc.objects,
      outlinePolygons: [],
    })
    const result = solveFinalProduct({
      foldLines: doc.foldLines,
      stitchHoles: doc.stitchHoles ?? [],
      regions,
      documentBounds: boundsForPrefix(doc, 'folding-box-net-box-base-outline'),
      thicknessMm: 1.4,
    })

    expect(result.panels.length).toBe(5)
    expect(result.hinges).toHaveLength(4)
    expect(result.diagnostics.filter((diagnostic) => diagnostic.code === 'fold-line-unresolved')).toHaveLength(0)
    const panelCentroid = (panel: (typeof result.panels)[number]) => ({
      x: panel.polygon.reduce((sum, point) => sum + point.x, 0) / panel.polygon.length,
      y: panel.polygon.reduce((sum, point) => sum + point.y, 0) / panel.polygon.length,
    })
    const solvedCentroidHeight = (panel: (typeof result.panels)[number]) => {
      const points = panel.polygon.map((point) => solvePanelPoint(panel, point))
      return points.reduce((sum, point) => sum + point.y, 0) / points.length
    }
    const backWall = result.panels.find((panel) => {
      const center = panelCentroid(panel)
      return center.y < -25 && center.y > -65 && Math.abs(center.x) < 36
    })
    const frontWall = result.panels.find((panel) => {
      const center = panelCentroid(panel)
      return center.y > 25 && center.y < 65 && Math.abs(center.x) < 36
    })
    expect(backWall).toBeDefined()
    expect(frontWall).toBeDefined()
    expect(solvedCentroidHeight(backWall!)).toBeGreaterThan(5)
    expect(solvedCentroidHeight(frontWall!)).toBeGreaterThan(5)
    expect(result.collisionWarningCount).toBe(0)
  })

  it('builds visible final-product mesh panels for browser folded-view smoke testing', () => {
    const doc = foldingBoxNetDoc()
    const { pieceMeshes, transform, documentBounds } = buildModelLayout({
      patternPieces: doc.patternPieces ?? [],
      outlinePolygons: [],
      shapes: doc.objects,
      foldLines: doc.foldLines,
    })
    const finalProductGroup = new Group()
    const result = rebuildFinalProductModel({
      layers: doc.layers,
      lineTypes: doc.lineTypes,
      shapes: doc.objects,
      foldLines: doc.foldLines,
      stitchHoles: doc.stitchHoles ?? [],
      outlinePolygons: [],
      patternPieces: doc.patternPieces ?? [],
      piecePlacements3d: doc.piecePlacements3d ?? [],
      seamConnections: doc.seamConnections ?? [],
      previewSettings: { ...DEFAULT_THREE_PREVIEW_SETTINGS, mode: 'final' },
      pieceMeshes,
      transform,
      documentBounds,
      threadColor: '#f97316',
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

    expect(result.hinges).toHaveLength(4)
    expect(result.diagnostics.filter((diagnostic) => diagnostic.code === 'fold-line-unresolved')).toHaveLength(0)
    expect(hasMesh(finalProductGroup)).toBe(true)
  })
})
