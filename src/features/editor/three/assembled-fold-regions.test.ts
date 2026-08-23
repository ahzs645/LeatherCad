import { describe, expect, it } from 'vitest'
import type { FoldLine, Point } from '../cad/cad-types'
import { regionContains, splitPieceByFolds } from './assembled-fold-regions'

function fold(id: string, start: Point, end: Point, angleDeg: number, direction?: FoldLine['direction']): FoldLine {
  return { id, name: id, start, end, angleDeg, maxAngleDeg: 180, direction }
}

/** A 100 wide x 120 tall panel, the shape of a wallet body. */
const panel: Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 120 },
  { x: 0, y: 120 },
]

function areaOf(polygon: Point[]) {
  let sum = 0
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

describe('splitPieceByFolds', () => {
  it('leaves a piece with no folds exactly as it was', () => {
    const regions = splitPieceByFolds(panel, [])

    expect(regions).toHaveLength(1)
    expect(regions[0].polygon).toEqual(panel)
    expect(regions[0].hinges).toEqual([])
  })

  it('hinges the smaller side and leaves the larger where the seams put it', () => {
    // Cut across at y = 40: a 40mm flap and an 80mm body.
    const regions = splitPieceByFolds(panel, [fold('flap', { x: 0, y: 40 }, { x: 100, y: 40 }, 180)])

    expect(regions).toHaveLength(2)
    const [stays, swings] = regions[0].hinges.length === 0 ? regions : [regions[1], regions[0]]
    expect(areaOf(stays.polygon)).toBeCloseTo(8000, 3)
    expect(stays.hinges).toEqual([])
    expect(areaOf(swings.polygon)).toBeCloseTo(4000, 3)
    expect(swings.hinges).toHaveLength(1)
    expect(swings.hinges[0].foldLineId).toBe('flap')
    expect(swings.hinges[0].angleDeg).toBe(180)
  })

  it('turns a mountain fold the other way from a valley', () => {
    const line = { start: { x: 0, y: 40 }, end: { x: 100, y: 40 } }
    const valley = splitPieceByFolds(panel, [fold('v', line.start, line.end, 90, 'valley')])
    const mountain = splitPieceByFolds(panel, [fold('m', line.start, line.end, 90, 'mountain')])

    const angleOf = (regions: ReturnType<typeof splitPieceByFolds>) =>
      regions.find((region) => region.hinges.length > 0)!.hinges[0].angleDeg
    expect(angleOf(valley)).toBe(90)
    expect(angleOf(mountain)).toBe(-90)
  })

  it('chains hinges so an accordion folds about each in turn', () => {
    // Two cuts. The second lands inside the larger part left by the first, so
    // one region carries no hinge, one carries the second, and one the first.
    const regions = splitPieceByFolds(panel, [
      fold('a', { x: 0, y: 30 }, { x: 100, y: 30 }, 90),
      fold('b', { x: 0, y: 80 }, { x: 100, y: 80 }, 90),
    ])

    expect(regions).toHaveLength(3)
    expect(regions.map((region) => region.hinges.length).sort()).toEqual([0, 1, 1])
    expect(regions.flatMap((region) => region.hinges.map((hinge) => hinge.foldLineId)).sort()).toEqual(['a', 'b'])
  })

  it('ignores a fold line that misses the piece', () => {
    const regions = splitPieceByFolds(panel, [fold('elsewhere', { x: 0, y: 400 }, { x: 100, y: 400 }, 90)])

    expect(regions).toHaveLength(1)
    expect(regions[0].hinges).toEqual([])
  })

  it('ignores a fold that only grazes an edge', () => {
    const regions = splitPieceByFolds(panel, [fold('edge', { x: 0, y: 0 }, { x: 100, y: 0 }, 90)])

    expect(regions).toHaveLength(1)
  })
})

describe('regionContains', () => {
  it('hands a stitch hole to the part of the piece it sits on', () => {
    const [first, second] = splitPieceByFolds(panel, [
      fold('flap', { x: 0, y: 40 }, { x: 100, y: 40 }, 180),
    ])
    const body = first.hinges.length === 0 ? first : second
    const flap = first.hinges.length === 0 ? second : first

    expect(regionContains(body, { x: 50, y: 90 })).toBe(true)
    expect(regionContains(flap, { x: 50, y: 90 })).toBe(false)
    expect(regionContains(flap, { x: 50, y: 20 })).toBe(true)
  })
})
