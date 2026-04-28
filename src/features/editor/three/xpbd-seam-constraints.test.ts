import { describe, expect, it } from 'vitest'
import type { StitchPair } from './final-product-types'
import { buildXpbdSeamDistanceConstraints } from './xpbd-seam-constraints'

describe('xpbd seam constraints', () => {
  it('builds weld distance constraints from stitch pairs', () => {
    const pair = {
      id: 'pair-1',
      reversed: false,
      left: { holes: [{ id: 'a' }, { id: 'b' }] },
      right: { holes: [{ id: 'c' }, { id: 'd' }] },
    } as StitchPair

    const constraints = buildXpbdSeamDistanceConstraints({
      stitchPairs: [pair],
      particleIndexByHoleId: new Map([
        ['a', 0],
        ['b', 1],
        ['c', 2],
        ['d', 3],
      ]),
    })

    expect(constraints).toHaveLength(2)
    expect(constraints[0]).toMatchObject({ kind: 'distance', a: 0, b: 2, restLength: 0 })
  })
})
