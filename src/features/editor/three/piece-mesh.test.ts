import { describe, expect, it } from 'vitest'
import type { PatternPiece } from '../cad/cad-types'
import { buildPieceMeshes, normalizeClosedPolygon } from './piece-mesh'
import type { OutlineChain } from '../ops/outline-detection'

describe('normalizeClosedPolygon', () => {
  it('drops a duplicate closing point', () => {
    const polygon = normalizeClosedPolygon([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 0 },
    ])

    expect(polygon).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
    ])
  })
})

describe('buildPieceMeshes', () => {
  it('builds ordered edges and preserves holes', () => {
    const piece: PatternPiece = {
      id: 'piece-1',
      name: 'Pocket',
      boundaryShapeId: 'outer-shape',
      internalShapeIds: ['inner-hole'],
      layerId: 'layer-1',
      quantity: 1,
      onFold: false,
      orientation: 'any',
      allowFlip: true,
      includeInLayout: true,
      locked: false,
    }

    const outer: OutlineChain = {
      id: 'outer',
      shapeIds: ['outer-shape'],
      polygon: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 20 },
        { x: 0, y: 20 },
        { x: 0, y: 0 },
      ],
      isClosed: true,
      area: 800,
    }
    const inner: OutlineChain = {
      id: 'inner',
      shapeIds: ['inner-hole'],
      polygon: [
        { x: 10, y: 5 },
        { x: 18, y: 5 },
        { x: 18, y: 12 },
        { x: 10, y: 12 },
        { x: 10, y: 5 },
      ],
      isClosed: true,
      area: 56,
    }

    const meshes = buildPieceMeshes([piece], new Map([
      ['outer-shape', outer],
      ['inner-hole', inner],
    ]))

    expect(meshes).toHaveLength(1)
    expect(meshes[0].outer).toHaveLength(4)
    expect(meshes[0].holes).toHaveLength(1)
    expect(meshes[0].edges).toHaveLength(4)
    expect(meshes[0].edges[0].lengthMm).toBe(40)
    expect(meshes[0].center).toEqual({ x: 20, y: 10 })
  })
})
