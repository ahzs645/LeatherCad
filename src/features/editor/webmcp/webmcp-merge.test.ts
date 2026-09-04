import { describe, expect, it } from 'vitest'
import { compileAiBuilderDocument } from '../ai-builder/ai-builder-compile'
import { createDefaultLineTypes, CUT_LINE_TYPE_ID } from '../cad/line-types'
import type { DocFile } from '../cad/cad-types'
import { buildPieceDocument } from './webmcp-document'
import { mergeCompiledDocument, type MergeTargets } from './webmcp-merge'

function emptyTargets(): MergeTargets {
  return {
    layers: [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false, stackLevel: 0 }],
    shapes: [],
    foldLines: [],
    stitchHoles: [],
    patternPieces: [],
    seamAllowances: [],
    seamConnections: [],
    hardwareMarkers: [],
  }
}

function compiledPiece(name: string, center = { x: 0, y: 0 }): DocFile {
  return compileAiBuilderDocument(
    buildPieceDocument({
      name,
      layerName: 'Agent',
      outline: {
        kind: 'rounded_rect',
        widthMm: 90,
        heightMm: 64,
        cornerRadiusMm: 6,
        strapEnd: 'round',
        scoopMm: 12,
      },
      center,
      quantity: 2,
      material: '3.2mm veg tan',
      onFold: false,
      stitchInsetMm: 4,
      stitchPitchMm: 4,
      seamAllowanceMm: 3,
    }).document,
  ).doc
}

describe('mergeCompiledDocument', () => {
  it('adds a piece without disturbing what is already open', () => {
    const current = emptyTargets()
    current.shapes.push({
      id: 'existing-shape',
      type: 'line',
      layerId: 'layer-1',
      lineTypeId: CUT_LINE_TYPE_ID,
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    })

    const merged = mergeCompiledDocument(current, compiledPiece('Wallet body'))

    expect(merged.shapes[0].id).toBe('existing-shape')
    expect(merged.patternPieces).toHaveLength(1)
    expect(merged.patternPieces[0].name).toBe('Wallet body')
    expect(merged.stitchHoles.length).toBeGreaterThan(10)
  })

  it('gives the same piece fresh ids the second time, so two calls do not collide', () => {
    const first = mergeCompiledDocument(emptyTargets(), compiledPiece('Panel'))
    const second = mergeCompiledDocument(first, compiledPiece('Panel', { x: 200, y: 0 }))

    expect(second.patternPieces).toHaveLength(2)
    const ids = second.shapes.map((shape) => shape.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(second.patternPieces[0].id).not.toBe(second.patternPieces[1].id)
  })

  it('rewrites every reference to the ids it just assigned', () => {
    const merged = mergeCompiledDocument(emptyTargets(), compiledPiece('Panel'))
    const shapeIds = new Set(merged.shapes.map((shape) => shape.id))
    const pieceIds = new Set(merged.patternPieces.map((piece) => piece.id))

    for (const piece of merged.patternPieces) {
      expect(shapeIds.has(piece.boundaryShapeId)).toBe(true)
    }
    for (const hole of merged.stitchHoles) {
      expect(shapeIds.has(hole.shapeId)).toBe(true)
    }
    for (const allowance of merged.seamAllowances) {
      expect(pieceIds.has((allowance as { pieceId: string }).pieceId)).toBe(true)
    }
  })

  it('reuses a layer of the same name instead of stacking duplicates', () => {
    const first = mergeCompiledDocument(emptyTargets(), compiledPiece('One'))
    const second = mergeCompiledDocument(first, compiledPiece('Two', { x: 200, y: 0 }))

    expect(second.layers.filter((layer) => layer.name === 'Agent')).toHaveLength(1)
    const agentLayer = second.layers.find((layer) => layer.name === 'Agent')
    expect(second.patternPieces.every((piece) => piece.layerId === agentLayer?.id)).toBe(true)
  })

  it('keeps the document line types rather than importing a second set', () => {
    const merged = mergeCompiledDocument(emptyTargets(), compiledPiece('Panel'))
    const documentLineTypeIds = new Set(createDefaultLineTypes().map((lineType) => lineType.id))
    for (const shape of merged.shapes) {
      expect(documentLineTypeIds.has(shape.lineTypeId)).toBe(true)
    }
  })

  it('continues the stitch hole sequence past the holes already placed', () => {
    const first = mergeCompiledDocument(emptyTargets(), compiledPiece('One'))
    const highestBefore = Math.max(...first.stitchHoles.map((hole) => hole.sequence))
    const second = mergeCompiledDocument(first, compiledPiece('Two', { x: 200, y: 0 }))
    const added = second.stitchHoles.slice(first.stitchHoles.length)

    expect(added.every((hole) => hole.sequence > highestBefore)).toBe(true)
  })
})
