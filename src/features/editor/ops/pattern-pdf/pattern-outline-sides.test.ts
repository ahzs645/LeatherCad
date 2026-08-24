import { describe, expect, it } from 'vitest'
import type { Point } from '../../cad/cad-types'
import { outlineSides } from './pattern-outline-sides'
import type { PdfPathSegment } from './pdf-vector-paths'

function line(from: Point, to: Point): PdfPathSegment {
  return { kind: 'line', from, to }
}

/** A quarter circle, drawn the way Illustrator rounds a corner. */
function quarter(centre: Point, radius: number, quadrant: 0 | 1 | 2 | 3): PdfPathSegment {
  const k = 0.5522847498 * radius
  const axes: Array<[Point, Point]> = [
    [{ x: 1, y: 0 }, { x: 0, y: 1 }],
    [{ x: 0, y: 1 }, { x: -1, y: 0 }],
    [{ x: -1, y: 0 }, { x: 0, y: -1 }],
    [{ x: 0, y: -1 }, { x: 1, y: 0 }],
  ]
  const [u, v] = axes[quadrant]
  const from = { x: centre.x + u.x * radius, y: centre.y + u.y * radius }
  const to = { x: centre.x + v.x * radius, y: centre.y + v.y * radius }
  return {
    kind: 'cubic',
    from,
    c1: { x: from.x + v.x * k, y: from.y + v.y * k },
    c2: { x: to.x + u.x * k, y: to.y + u.y * k },
    to,
  }
}

describe('outlineSides', () => {
  it('joins collinear segments into one side', () => {
    const sides = outlineSides(
      [
        line({ x: 0, y: 0 }, { x: 40, y: 0 }),
        line({ x: 40, y: 0 }, { x: 100, y: 0 }),
        line({ x: 100, y: 0 }, { x: 100, y: 60 }),
        line({ x: 100, y: 60 }, { x: 0, y: 60 }),
        line({ x: 0, y: 60 }, { x: 0, y: 0 }),
      ],
      'panel',
    )

    expect(sides).toHaveLength(4)
    expect(sides[0].lengthMm).toBeCloseTo(100, 6)
    expect(sides[0].start).toEqual({ x: 0, y: 0 })
    expect(sides[0].end).toEqual({ x: 100, y: 0 })
  })

  it('joins the run that wraps the start of the path', () => {
    // The path starts halfway along the top edge, as Illustrator leaves it when
    // the pen happened to be there. Grouping without rotating first would
    // report that edge as the first and last sides of the piece.
    const sides = outlineSides(
      [
        line({ x: 50, y: 0 }, { x: 100, y: 0 }),
        line({ x: 100, y: 0 }, { x: 100, y: 60 }),
        line({ x: 100, y: 60 }, { x: 0, y: 60 }),
        line({ x: 0, y: 60 }, { x: 0, y: 0 }),
        line({ x: 0, y: 0 }, { x: 50, y: 0 }),
      ],
      'panel',
    )

    expect(sides).toHaveLength(4)
    expect(sides.filter((side) => side.lengthMm === 100)).toHaveLength(2)
  })

  it('drops the zero-length stub a duplicate anchor leaves and keeps the outline closed', () => {
    const sides = outlineSides(
      [
        line({ x: 0, y: 0 }, { x: 100, y: 0 }),
        line({ x: 100, y: 0 }, { x: 100, y: 60 }),
        line({ x: 100, y: 60 }, { x: 100.01, y: 60 }),
        line({ x: 100.01, y: 60 }, { x: 0, y: 60 }),
        line({ x: 0, y: 60 }, { x: 0, y: 0 }),
      ],
      'panel',
    )

    expect(sides).toHaveLength(4)
    for (let index = 0; index < sides.length; index += 1) {
      const next = sides[(index + 1) % sides.length]
      expect(Math.hypot(next.start.x - sides[index].end.x, next.start.y - sides[index].end.y)).toBeLessThan(1e-9)
    }
  })

  it('keeps a corner round as its own side even though it meets both edges tangentially', () => {
    const sides = outlineSides(
      [
        line({ x: 10, y: 0 }, { x: 90, y: 0 }),
        quarter({ x: 90, y: 10 }, 10, 3),
        line({ x: 100, y: 10 }, { x: 100, y: 50 }),
      ],
      'panel',
    )

    expect(sides.map((side) => side.kind)).toEqual(['line', 'curve', 'line'])
  })

  it('joins two curves that flow into each other into one wavy side', () => {
    const sides = outlineSides(
      [
        { kind: 'cubic', from: { x: 0, y: 0 }, c1: { x: 0, y: 20 }, c2: { x: 20, y: 30 }, to: { x: 20, y: 50 } },
        { kind: 'cubic', from: { x: 20, y: 50 }, c1: { x: 20, y: 70 }, c2: { x: 0, y: 80 }, to: { x: 0, y: 100 } },
        line({ x: 0, y: 100 }, { x: 0, y: 0 }),
      ],
      'pocket',
    )

    expect(sides.map((side) => side.kind)).toEqual(['curve', 'line'])
    expect(sides[0].segments).toHaveLength(2)
  })
})
