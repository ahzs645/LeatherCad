import { describe, expect, it } from 'vitest'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { buildThreadSegments, chainRunSegments, createThreadMaterial } from './stitch-thread'

describe('chainRunSegments', () => {
  it('links consecutive holes into runs', () => {
    const points = [new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(1, 1, 0)]
    const segments = chainRunSegments(points)
    expect(segments).toHaveLength(2)
    expect(segments[0].start).toBe(points[0])
    expect(segments[0].end).toBe(points[1])
    expect(segments[1].start).toBe(points[1])
    expect(segments[1].end).toBe(points[2])
  })

  it('yields nothing for a single hole', () => {
    expect(chainRunSegments([new Vector3(0, 0, 0)])).toHaveLength(0)
  })
})

describe('buildThreadSegments', () => {
  const material = createThreadMaterial('#eab308')

  it('returns null when every segment is degenerate', () => {
    const point = new Vector3(2, 3, 4)
    expect(buildThreadSegments([{ start: point, end: point.clone() }], material, 0.003, 'x')).toBeNull()
  })

  it('instances one cylinder per non-degenerate segment', () => {
    const mesh = buildThreadSegments(
      [
        { start: new Vector3(0, 0, 0), end: new Vector3(0, 0, 0) },
        { start: new Vector3(0, 0, 0), end: new Vector3(2, 0, 0) },
        { start: new Vector3(0, 1, 0), end: new Vector3(0, 1, 3) },
      ],
      material,
      0.003,
      'thread',
    )
    expect(mesh).not.toBeNull()
    expect(mesh?.count).toBe(2)
    expect(mesh?.name).toBe('thread')
  })

  it('places each instance at the segment midpoint, scaled to its length, aligned to its direction', () => {
    const start = new Vector3(1, 2, 3)
    const end = new Vector3(5, 2, 3)
    const mesh = buildThreadSegments([{ start, end }], material, 0.003, 'thread')
    expect(mesh).not.toBeNull()

    const matrix = new Matrix4()
    mesh?.getMatrixAt(0, matrix)
    const position = new Vector3()
    const rotation = new Quaternion()
    const scale = new Vector3()
    matrix.decompose(position, rotation, scale)

    expect(position.x).toBeCloseTo(3, 6)
    expect(position.y).toBeCloseTo(2, 6)
    expect(position.z).toBeCloseTo(3, 6)
    expect(scale.y).toBeCloseTo(4, 6)

    // The unit-height cylinder's Y axis must land on the segment direction.
    const axis = new Vector3(0, 1, 0).applyQuaternion(rotation)
    expect(Math.abs(axis.dot(new Vector3(1, 0, 0)))).toBeCloseTo(1, 6)
  })
})
