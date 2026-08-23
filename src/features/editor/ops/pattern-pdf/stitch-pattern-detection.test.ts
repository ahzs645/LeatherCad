import { describe, expect, it } from 'vitest'
import type { Point } from '../../cad/cad-types'
import { detectStitchPattern } from './stitch-pattern-detection'
import type { PatternDot } from './pattern-separation'

let counter = 0

function dot(centre: Point, diameterMm = 1.13, paint: PatternDot['paint'] = 'fill'): PatternDot {
  counter += 1
  return { id: `dot-${counter}`, center: centre, diameterMm, paint }
}

/** A straight run of holes at `pitch`, starting at `from` heading `direction`. */
function row(from: Point, direction: Point, count: number, pitch = 5) {
  const length = Math.hypot(direction.x, direction.y)
  return Array.from({ length: count }, (_, index) =>
    dot({
      x: from.x + (direction.x / length) * pitch * index,
      y: from.y + (direction.y / length) * pitch * index,
    }),
  )
}

describe('detectStitchPattern', () => {
  it('reads a straight row as one run and measures its pitch', () => {
    const pattern = detectStitchPattern(row({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, 4))

    expect(pattern.chains).toHaveLength(1)
    expect(pattern.chains[0].holeCount).toBe(10)
    expect(pattern.chains[0].pitchMm).toBeCloseTo(4, 6)
    expect(pattern.chains[0].stitchesPerInch).toBeCloseTo(6.35, 2)
    expect(pattern.chains[0].lengthMm).toBeCloseTo(36, 6)
    expect(pattern.chains[0].closed).toBe(false)
  })

  it('follows a run around a corner instead of stopping at it', () => {
    const down = row({ x: 0, y: 0 }, { x: 0, y: 1 }, 8)
    const across = row({ x: 5, y: 35 }, { x: 1, y: 0 }, 8)

    const pattern = detectStitchPattern([...down, ...across])

    expect(pattern.chains).toHaveLength(1)
    expect(pattern.chains[0].holeCount).toBe(16)
    expect(pattern.chains[0].cornerCount).toBeGreaterThanOrEqual(1)
  })

  it('keeps two parallel rows apart', () => {
    const near = row({ x: 0, y: 0 }, { x: 1, y: 0 }, 8)
    const far = row({ x: 0, y: 9 }, { x: 1, y: 0 }, 8)

    const pattern = detectStitchPattern([...near, ...far])

    expect(pattern.chains).toHaveLength(2)
    expect(pattern.chains.map((chain) => chain.holeCount)).toEqual([8, 8])
  })

  it('walks a run end to end rather than starting in the middle', () => {
    const holes = row({ x: 0, y: 0 }, { x: 1, y: 0 }, 9, 4)
    // Shuffled, because nothing about the PDF guarantees an order.
    const shuffled = [holes[4], holes[0], holes[7], holes[2], holes[8], holes[1], holes[5], holes[3], holes[6]]

    const [chain] = detectStitchPattern(shuffled).chains

    expect(chain.holeCount).toBe(9)
    expect(chain.pitchMm).toBeCloseTo(4, 6)
    expect(Math.abs(chain.dots[0].center.x - chain.dots[8].center.x)).toBeCloseTo(32, 6)
  })

  it('recognises a run that closes on itself', () => {
    const radius = 20
    const count = 30
    const holes = Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2
      return dot({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
    })

    const [chain] = detectStitchPattern(holes).chains

    expect(chain.holeCount).toBe(count)
    expect(chain.closed).toBe(true)
  })

  it('leaves an isolated hardware mark out of the stitching', () => {
    const holes = row({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, 4)
    const snap = dot({ x: 20, y: 40 }, 2.35, 'stroke')

    const pattern = detectStitchPattern([...holes, snap])

    expect(pattern.chains).toHaveLength(1)
    expect(pattern.looseDots.map((entry) => entry.id)).toEqual([snap.id])
  })

  it('reports nothing when there are too few marks to be a run', () => {
    const pattern = detectStitchPattern([dot({ x: 0, y: 0 }), dot({ x: 4, y: 0 })])

    expect(pattern.chains).toHaveLength(0)
    expect(pattern.looseDots).toHaveLength(2)
  })

  it('measures how ragged a hand-punched run is', () => {
    const holes = [
      dot({ x: 0, y: 0 }),
      dot({ x: 4, y: 0 }),
      dot({ x: 8.8, y: 0 }),
      dot({ x: 12.8, y: 0 }),
    ]

    const [chain] = detectStitchPattern(holes).chains

    expect(chain.pitchMm).toBeCloseTo(4.2667, 3)
    expect(chain.pitchSpreadMm).toBeCloseTo(0.5333, 3)
  })
})
