import { describe, expect, it } from 'vitest'
import { Group, Mesh, Vector3 } from 'three'
import type { PieceMeshData } from './piece-mesh'
import { nearestBoundaryEdge, pieceIdForObject, worldPointToDocument } from './seam-edge-picking'

function panel(): PieceMeshData {
  const outer = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 60 },
    { x: 0, y: 60 },
  ]
  const edge = (index: number, start: { x: number; y: number }, end: { x: number; y: number }) => ({
    index,
    start,
    end,
    midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    lengthMm: Math.hypot(end.x - start.x, end.y - start.y),
  })
  return {
    pieceId: 'panel',
    name: 'Panel',
    outer,
    holes: [],
    shapeSegments: [
      { shapeId: 'panel-top', firstEdgeIndex: 0, lastEdgeIndex: 0 },
      { shapeId: 'panel-right', firstEdgeIndex: 1, lastEdgeIndex: 1 },
      { shapeId: 'panel-bottom', firstEdgeIndex: 2, lastEdgeIndex: 2 },
      { shapeId: 'panel-left', firstEdgeIndex: 3, lastEdgeIndex: 3 },
    ],
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 60, width: 100, height: 60 },
    center: { x: 50, y: 30 },
    edges: [
      edge(0, outer[0], outer[1]),
      edge(1, outer[1], outer[2]),
      edge(2, outer[2], outer[3]),
      edge(3, outer[3], outer[0]),
    ],
  }
}

/** A curved side sampled into eight chords, as an arc boundary really is. */
function curvedPanel(): PieceMeshData {
  const curve = Array.from({ length: 9 }, (_, index) => ({ x: 100, y: index * 7.5 }))
  const outer = [{ x: 0, y: 0 }, ...curve, { x: 0, y: 60 }]
  const edges = [
    { index: 0, start: outer[0], end: curve[0], midpoint: { x: 50, y: 0 }, lengthMm: 100 },
    ...curve.slice(0, -1).map((point, index) => ({
      index: index + 1,
      start: point,
      end: curve[index + 1],
      midpoint: { x: 100, y: point.y + 3.75 },
      lengthMm: 7.5,
    })),
  ]
  return {
    ...panel(),
    outer,
    edges,
    shapeSegments: [
      { shapeId: 'panel-top', firstEdgeIndex: 0, lastEdgeIndex: 0 },
      { shapeId: 'panel-curve', firstEdgeIndex: 1, lastEdgeIndex: 8 },
    ],
  }
}

describe('pieceIdForObject', () => {
  it('walks up to the piece group that owns the hit object', () => {
    const group = new Group()
    group.userData.pieceId = 'front'
    const inner = new Group()
    const mesh = new Mesh()
    inner.add(mesh)
    group.add(inner)

    expect(pieceIdForObject(mesh)).toBe('front')
  })

  it('returns null when nothing in the chain is a piece', () => {
    expect(pieceIdForObject(new Mesh())).toBeNull()
    expect(pieceIdForObject(null)).toBeNull()
  })
})

describe('worldPointToDocument', () => {
  const transform = { scale: 0.01, centerX: 50, centerY: 30 }

  it('undoes the viewport mapping for an unplaced piece', () => {
    const group = new Group()
    group.updateMatrixWorld(true)

    // (80, 45) in document space projects to ((80-50)*0.01, (45-30)*0.01) in
    // world X and Z.
    const world = new Vector3(0.3, 0, 0.15)

    expect(worldPointToDocument(world, group, transform)).toEqual({ x: 80, y: 45 })
  })

  it('accounts for the placement of the piece itself', () => {
    const group = new Group()
    group.position.set(0.5, 0, 0.25)
    group.updateMatrixWorld(true)

    const world = new Vector3(0.8, 0, 0.4)

    const documentPoint = worldPointToDocument(world, group, transform)
    expect(documentPoint.x).toBeCloseTo(80, 6)
    expect(documentPoint.y).toBeCloseTo(45, 6)
  })
})

describe('nearestBoundaryEdge', () => {
  it('names the edge nearest the point and the shape that owns it', () => {
    const hit = nearestBoundaryEdge(panel(), { x: 99, y: 30 })

    expect(hit?.edgeIndex).toBe(1)
    expect(hit?.boundaryShapeId).toBe('panel-right')
    expect(hit?.distanceMm).toBeCloseTo(1, 6)
  })

  it('reports where along the edge the click landed', () => {
    // The right edge runs from y=0 to y=60, so three quarters along is y=45.
    expect(nearestBoundaryEdge(panel(), { x: 100, y: 45 })?.parameter).toBeCloseTo(0.75, 6)
  })

  it('measures the parameter along a whole curved side, not one chord', () => {
    const piece = curvedPanel()

    // Half way up the curve, which lands inside the fifth of eight chords. A
    // per-chord parameter would read near 0 or 1 and give a meaningless
    // direction for the seam.
    const hit = nearestBoundaryEdge(piece, { x: 100, y: 30 })

    expect(hit?.boundaryShapeId).toBe('panel-curve')
    expect(hit?.parameter).toBeCloseTo(0.5, 2)
  })

  it('returns null for a piece with no edges', () => {
    expect(nearestBoundaryEdge({ ...panel(), edges: [] }, { x: 0, y: 0 })).toBeNull()
  })
})
