import { describe, expect, it } from 'vitest'
import type { FoldLine } from '../cad/cad-types'
import { buildFinalProductPanelGraph } from './final-product-panel-graph'

const rectangleOutline = [{
  layerId: 'layer-1',
  shapeIds: ['outline'],
  polygon: [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 10 },
    { x: 0, y: 10 },
  ],
}]

function foldLine(id: string, start: { x: number; y: number }, end: { x: number; y: number }): FoldLine {
  return {
    id,
    name: id,
    start,
    end,
    angleDeg: 90,
    maxAngleDeg: 180,
    direction: 'mountain',
  }
}

describe('final product panel graph', () => {
  it('splits a physical region into two rigid panels and one hinge', () => {
    const graph = buildFinalProductPanelGraph({
      foldLines: [foldLine('fold-x', { x: 10, y: -5 }, { x: 10, y: 15 })],
      outlinePolygons: rectangleOutline,
      documentBounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
    })

    expect(graph.panels).toHaveLength(2)
    expect(graph.hinges).toHaveLength(1)
    expect(graph.hinges[0].foldLine.id).toBe('fold-x')
    expect(graph.diagnostics).toHaveLength(0)
  })

  it('builds a four-panel graph from crossing fold lines', () => {
    const graph = buildFinalProductPanelGraph({
      foldLines: [
        foldLine('fold-x', { x: 10, y: -5 }, { x: 10, y: 15 }),
        foldLine('fold-y', { x: -5, y: 5 }, { x: 25, y: 5 }),
      ],
      outlinePolygons: rectangleOutline,
      documentBounds: { minX: 0, maxX: 20, minY: 0, maxY: 10 },
    })

    expect(graph.panels).toHaveLength(4)
    expect(graph.hinges.length).toBeGreaterThanOrEqual(2)
  })
})
