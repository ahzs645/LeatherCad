import { describe, expect, it } from 'vitest'
import type { PatternPiece, SeamConnection } from '../cad/cad-types'
import type { OutlineChain } from '../ops/outline-detection'
import {
  describeSeamConnection,
  reconcileSeamConnections,
  resolveSeamSpans,
  seamPieceIds,
  seamsInSewOrder,
  withMirroredSingleRefs,
} from './seam-spans'

function piece(id: string, name: string, boundaryShapeId: string): PatternPiece {
  return {
    id,
    name,
    boundaryShapeId,
    internalShapeIds: [],
    layerId: 'layer-1',
    quantity: 1,
    onFold: false,
    orientation: 'any',
    allowFlip: true,
    includeInLayout: true,
    locked: false,
  }
}

/** A four-sided chain whose second side is a sampled curve spanning many edges. */
function curvedChain(shapeIds: [string, string, string, string]): OutlineChain {
  const polygon = [
    { x: 0, y: 0 },
    { x: 60, y: 0 },
    ...Array.from({ length: 47 }, (_, index) => ({ x: 60 + index * 0.1, y: (index + 1) * 0.8 })),
    { x: 60, y: 40 },
    { x: 0, y: 40 },
    { x: 0, y: 0 },
  ]
  return {
    id: 'chain',
    shapeIds,
    polygon,
    segments: [
      { shapeId: shapeIds[0], startIndex: 0, endIndex: 1, reversed: false },
      { shapeId: shapeIds[1], startIndex: 1, endIndex: 49, reversed: false },
      { shapeId: shapeIds[2], startIndex: 49, endIndex: 50, reversed: false },
      { shapeId: shapeIds[3], startIndex: 50, endIndex: 51, reversed: false },
    ],
    isClosed: true,
    area: 2400,
  }
}

describe('resolveSeamSpans', () => {
  const base = {
    id: 'seam-1',
    from: { pieceId: 'a', edgeIndex: 2 },
    to: { pieceId: 'b', edgeIndex: 5 },
    kind: 'sewn',
  } satisfies SeamConnection

  it('reads a bare edge reference as one full-length span', () => {
    expect(resolveSeamSpans(base, 'from')).toEqual([
      { pieceId: 'a', edgeIndex: 2, boundaryShapeId: undefined, t0: 0, t1: 1, reversed: undefined },
    ])
  })

  it('prefers the single span over the bare reference', () => {
    const connection: SeamConnection = {
      ...base,
      fromSpan: { pieceId: 'a', edgeIndex: 2, t0: 0.25, t1: 0.75 },
    }

    expect(resolveSeamSpans(connection, 'from')).toEqual([
      { pieceId: 'a', edgeIndex: 2, t0: 0.25, t1: 0.75 },
    ])
  })

  it('prefers the span list over both', () => {
    const connection: SeamConnection = {
      ...base,
      fromSpan: { pieceId: 'a', edgeIndex: 2, t0: 0, t1: 1 },
      fromSpans: [
        { pieceId: 'a', edgeIndex: 2, t0: 0, t1: 1 },
        { pieceId: 'a', edgeIndex: 3, t0: 0, t1: 1 },
      ],
    }

    expect(resolveSeamSpans(connection, 'from')).toHaveLength(2)
  })

  it('lists every piece a seam touches, from side first', () => {
    const connection: SeamConnection = {
      ...base,
      fromSpans: [
        { pieceId: 'gusset', edgeIndex: 0, t0: 0, t1: 1 },
        { pieceId: 'gusset', edgeIndex: 1, t0: 0, t1: 1 },
      ],
      toSpans: [{ pieceId: 'front', edgeIndex: 3, t0: 0, t1: 1 }],
    }

    expect(seamPieceIds(connection)).toEqual(['gusset', 'front'])
  })
})

describe('withMirroredSingleRefs', () => {
  it('keeps the legacy single fields pointing at the first span of each side', () => {
    const connection = withMirroredSingleRefs(
      { id: 'seam-1', from: { pieceId: 'x', edgeIndex: 0 }, to: { pieceId: 'y', edgeIndex: 0 }, kind: 'sewn' },
      [
        { pieceId: 'gusset', edgeIndex: 4, boundaryShapeId: 'g-left', t0: 0, t1: 1 },
        { pieceId: 'gusset', edgeIndex: 5, boundaryShapeId: 'g-base', t0: 0, t1: 1 },
      ],
      [{ pieceId: 'front', edgeIndex: 1, boundaryShapeId: 'f-left', t0: 0, t1: 1 }],
    )

    expect(connection.from).toEqual({ pieceId: 'gusset', edgeIndex: 4, boundaryShapeId: 'g-left' })
    expect(connection.to).toEqual({ pieceId: 'front', edgeIndex: 1, boundaryShapeId: 'f-left' })
    expect(connection.fromSpans).toHaveLength(2)
    // A single-span side stays on the compact representation.
    expect(connection.toSpans).toBeUndefined()
  })
})

describe('reconcileSeamConnections', () => {
  const shapeIds: [string, string, string, string] = ['s-bottom', 's-curve', 's-top', 's-left']
  const chain = curvedChain(shapeIds)
  const pieces = [piece('a', 'Panel', 's-bottom')]
  const chainsByShapeId = new Map(shapeIds.map((shapeId) => [shapeId, chain]))

  it('backfills the boundary shape id from the current geometry', () => {
    const { connections } = reconcileSeamConnections({
      seamConnections: [
        { id: 'seam-1', from: { pieceId: 'a', edgeIndex: 0 }, to: { pieceId: 'a', edgeIndex: 49 }, kind: 'sewn' },
      ],
      patternPieces: pieces,
      chainsByShapeId,
    })

    expect(resolveSeamSpans(connections[0], 'from')[0].boundaryShapeId).toBe('s-bottom')
    expect(resolveSeamSpans(connections[0], 'to')[0].boundaryShapeId).toBe('s-top')
  })

  it('rewrites an index that has drifted off the shape it names', () => {
    // Authored against older geometry where the curve started at edge 1; the
    // curve now runs 1..48, so an index of 30 is still inside it and stands.
    // An index of 0 is not, and gets pulled back to the curve's first edge.
    const { connections, repairedSeamIds } = reconcileSeamConnections({
      seamConnections: [
        {
          id: 'seam-1',
          from: { pieceId: 'a', edgeIndex: 0, boundaryShapeId: 's-curve' },
          to: { pieceId: 'a', edgeIndex: 30, boundaryShapeId: 's-curve' },
          kind: 'sewn',
        },
      ],
      patternPieces: pieces,
      chainsByShapeId,
    })

    expect(repairedSeamIds).toEqual(['seam-1'])
    expect(resolveSeamSpans(connections[0], 'from')[0].edgeIndex).toBe(1)
    expect(resolveSeamSpans(connections[0], 'to')[0].edgeIndex).toBe(30)
  })

  it('leaves seams alone when the named shape is gone', () => {
    const input: SeamConnection[] = [
      {
        id: 'seam-1',
        from: { pieceId: 'a', edgeIndex: 7, boundaryShapeId: 'deleted-shape' },
        to: { pieceId: 'a', edgeIndex: 49, boundaryShapeId: 's-top' },
        kind: 'sewn',
      },
    ]

    const { connections, repairedSeamIds } = reconcileSeamConnections({
      seamConnections: input,
      patternPieces: pieces,
      chainsByShapeId,
    })

    expect(repairedSeamIds).toEqual([])
    expect(connections[0]).toBe(input[0])
  })
})

describe('seam naming and order', () => {
  const names = new Map([
    ['gusset', 'Gusset'],
    ['front', 'Front Panel'],
  ])

  it('names a seam by the pieces it joins, noting a multi-edge side', () => {
    const connection: SeamConnection = {
      id: 'seam-1',
      from: { pieceId: 'gusset', edgeIndex: 0 },
      to: { pieceId: 'front', edgeIndex: 1 },
      fromSpans: [
        { pieceId: 'gusset', edgeIndex: 0, t0: 0, t1: 1 },
        { pieceId: 'gusset', edgeIndex: 1, t0: 0, t1: 1 },
      ],
      kind: 'sewn',
    }

    expect(describeSeamConnection(connection, names)).toBe('Gusset (2 edges) → Front Panel')
  })

  it('prefers an authored name', () => {
    expect(
      describeSeamConnection(
        { id: 's', name: 'Side seam', from: { pieceId: 'gusset', edgeIndex: 0 }, to: { pieceId: 'front', edgeIndex: 0 }, kind: 'sewn' },
        names,
      ),
    ).toBe('Side seam')
  })

  it('sews by sequence, and leaves unsequenced seams in document order at the end', () => {
    const make = (id: string, sequence?: number): SeamConnection => ({
      id,
      sequence,
      from: { pieceId: 'a', edgeIndex: 0 },
      to: { pieceId: 'b', edgeIndex: 0 },
      kind: 'sewn',
    })

    const ordered = seamsInSewOrder([make('c'), make('a', 2), make('d'), make('b', 1)])

    expect(ordered.map((seam) => seam.id)).toEqual(['b', 'a', 'c', 'd'])
  })
})
