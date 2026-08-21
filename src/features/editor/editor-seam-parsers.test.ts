import { describe, expect, it } from 'vitest'
import { parsePieceEdgeSpan } from './editor-assembly-parsers'
import { parseSeamConnection } from './editor-parsers'

/**
 * The parser rebuilds a seam field by field rather than spreading the input, so
 * anything it does not name is dropped on load. That is deliberate — it is what
 * keeps malformed documents out — but it means every field the seam model gains
 * has to be added here too, or the feature works in tests and silently does
 * nothing in the running app.
 */
describe('parseSeamConnection', () => {
  const minimal = {
    id: 'seam-1',
    from: { pieceId: 'a', edgeIndex: 2 },
    to: { pieceId: 'b', edgeIndex: 5 },
    kind: 'sewn',
  }

  it('keeps the boundary shape id on both sides', () => {
    const parsed = parseSeamConnection({
      ...minimal,
      from: { pieceId: 'a', edgeIndex: 2, boundaryShapeId: 'a-left' },
      to: { pieceId: 'b', edgeIndex: 5, boundaryShapeId: 'b-right' },
    })

    expect(parsed?.from.boundaryShapeId).toBe('a-left')
    expect(parsed?.to.boundaryShapeId).toBe('b-right')
  })

  it('keeps multi-span sides', () => {
    const span = (pieceId: string, edgeIndex: number, boundaryShapeId: string) => ({
      pieceId,
      edgeIndex,
      boundaryShapeId,
      t0: 0,
      t1: 1,
    })

    const parsed = parseSeamConnection({
      ...minimal,
      fromSpans: [span('a', 0, 'a-left'), span('a', 1, 'a-base'), span('a', 2, 'a-right')],
      toSpans: [span('b', 0, 'b-top')],
    })

    expect(parsed?.fromSpans).toHaveLength(3)
    expect(parsed?.fromSpans?.map((entry) => entry.boundaryShapeId)).toEqual(['a-left', 'a-base', 'a-right'])
    expect(parsed?.toSpans).toHaveLength(1)
  })

  it('drops a span list outright rather than silently shortening it', () => {
    const parsed = parseSeamConnection({
      ...minimal,
      fromSpans: [
        { pieceId: 'a', edgeIndex: 0, t0: 0, t1: 1 },
        { pieceId: 'a', edgeIndex: 'nonsense' },
      ],
    })

    // Half a seam is worse than none: it would sew the wrong length.
    expect(parsed?.fromSpans).toBeUndefined()
  })

  it('keeps the name and the sewing sequence', () => {
    const parsed = parseSeamConnection({ ...minimal, name: 'Left side seam', sequence: 3 })

    expect(parsed?.name).toBe('Left side seam')
    expect(parsed?.sequence).toBe(3)
  })

  it('still rejects a seam with no usable edge reference', () => {
    expect(parseSeamConnection({ id: 'x', from: { pieceId: 'a' }, to: { pieceId: 'b' } })).toBeNull()
    expect(parseSeamConnection(null)).toBeNull()
  })

  it('leaves optional fields undefined when absent', () => {
    const parsed = parseSeamConnection(minimal)

    expect(parsed?.name).toBeUndefined()
    expect(parsed?.sequence).toBeUndefined()
    expect(parsed?.fromSpans).toBeUndefined()
    expect(parsed?.from.boundaryShapeId).toBeUndefined()
  })
})

describe('parsePieceEdgeSpan', () => {
  it('keeps the boundary shape id', () => {
    expect(
      parsePieceEdgeSpan({ pieceId: 'a', edgeIndex: 4, boundaryShapeId: 'a-curve', t0: 0.25, t1: 0.75 }),
    ).toEqual({
      pieceId: 'a',
      edgeIndex: 4,
      boundaryShapeId: 'a-curve',
      t0: 0.25,
      t1: 0.75,
      reversed: false,
    })
  })

  it('clamps the span parameters into range', () => {
    const parsed = parsePieceEdgeSpan({ pieceId: 'a', edgeIndex: 0, t0: -3, t1: 9 })

    expect(parsed?.t0).toBe(0)
    expect(parsed?.t1).toBe(1)
  })
})
