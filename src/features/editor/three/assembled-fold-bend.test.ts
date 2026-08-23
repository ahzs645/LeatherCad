import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { BEND_SEGMENTS, bendCentre, buildBendGeometry, minimumBendRadiusMm } from './assembled-fold-bend'

const start = new Vector3(0, 0, 0)
const end = new Vector3(1, 0, 0)

function build(overrides: Partial<Parameters<typeof buildBendGeometry>[0]> = {}) {
  return buildBendGeometry({ start, end, angleRad: Math.PI / 2, halfThickness: 0.05, ...overrides })
}

describe('buildBendGeometry', () => {
  it('draws nothing while the fold is flat', () => {
    expect(build({ angleRad: 0 })).toBeNull()
  })

  it('draws nothing for leather with no thickness', () => {
    expect(build({ halfThickness: 0 })).toBeNull()
  })

  it('draws nothing for a crease of no length', () => {
    expect(build({ end: start.clone() })).toBeNull()
  })

  it('starts on the surface of the half that stays', () => {
    const bend = build()
    expect(bend).not.toBeNull()
    // The first ring is the crease lifted straight up by the half thickness —
    // exactly where the stationary half's own front face ends.
    expect(bend!.frontTriangles[0].toArray()).toEqual([0, 0.05, 0])
  })

  it('ends on the surface of the half that swings', () => {
    const bend = build({ angleRad: Math.PI / 2 })!
    // A quarter turn about the crease — which runs along +X — takes the surface
    // normal from +Y to +Z by the right-hand rule. The swinging half's group is
    // rotated by the same signed angle about the same axis, so its front face
    // is exactly there and the arc lands on it.
    const last = bend.frontTriangles[bend.frontTriangles.length - 1]
    expect(last.x).toBeCloseTo(0, 10)
    expect(last.y).toBeCloseTo(0, 10)
    expect(last.z).toBeCloseTo(0.05, 10)
  })

  it('keeps every point of the arc one half-thickness from the crease', () => {
    const bend = build({ angleRad: (Math.PI * 5) / 6 })!
    for (const point of [...bend.frontTriangles, ...bend.backTriangles]) {
      // Distance to the crease, which runs along X through the origin.
      expect(Math.hypot(point.y, point.z)).toBeCloseTo(0.05, 10)
    }
  })

  it('sweeps the arc the way the fold turns', () => {
    const valley = build({ angleRad: Math.PI / 2 })!
    const mountain = build({ angleRad: -Math.PI / 2 })!
    const lastOf = (bend: typeof valley) => bend.frontTriangles[bend.frontTriangles.length - 1]
    expect(lastOf(valley).z).toBeCloseTo(0.05, 10)
    expect(lastOf(mountain).z).toBeCloseTo(-0.05, 10)
  })

  it('closes the cross-section at both ends of the crease', () => {
    const bend = build()!
    const xs = new Set(bend.capTriangles.map((point) => Number(point.x.toFixed(6))))
    // One cap on the crease's start, one on its end, and nothing in between:
    // the caps are the only cut faces the bend contributes.
    expect(xs).toEqual(new Set([0, 1]))
  })

  it('tessellates the arc at the segment count it was given', () => {
    const coarse = build({ segments: 2 })!
    const fine = build()!
    expect(coarse.frontTriangles).toHaveLength(2 * 6)
    expect(fine.frontTriangles).toHaveLength(BEND_SEGMENTS * 6)
  })
})

describe('bend radius', () => {
  it('carries the half that swings a bend diameter clear of the half that stays', () => {
    const bendRadius = 0.5
    const bend = build({ angleRad: Math.PI, bendRadius })!
    // Fully closed, the mid-surface has come round a diameter — 1.0 — and the
    // outer surface sits a half thickness beyond that. This gap is the whole
    // point: it is the room a flap has to close over what is sewn under it.
    const last = bend.frontTriangles[bend.frontTriangles.length - 1]
    expect(last.y).toBeCloseTo(-(2 * bendRadius + 0.05), 6)
  })

  it('keeps the outer surface a half thickness proud of the arc', () => {
    const bendRadius = 0.5
    const bend = build({ angleRad: Math.PI / 2, bendRadius })!
    const centre = bendCentre(new Vector3(0, 0, 0), Math.PI / 2, bendRadius)
    for (const point of bend.frontTriangles) {
      expect(Math.hypot(point.y - centre.y, point.z - centre.z)).toBeCloseTo(bendRadius + 0.05, 10)
    }
  })

  it('keeps the inner surface a half thickness inside the arc', () => {
    const bendRadius = 0.5
    const bend = build({ angleRad: Math.PI / 2, bendRadius })!
    const centre = bendCentre(new Vector3(0, 0, 0), Math.PI / 2, bendRadius)
    for (const point of bend.backTriangles) {
      expect(Math.hypot(point.y - centre.y, point.z - centre.z)).toBeCloseTo(bendRadius - 0.05, 10)
    }
  })

  it('creases to a point at radius zero, as it did before', () => {
    expect(build({ bendRadius: 0 })!.frontTriangles[0].toArray()).toEqual([0, 0.05, 0])
  })
})

describe('minimumBendRadiusMm', () => {
  it('clears the fold’s own two halves when nothing is inside it', () => {
    // 1.8mm leather: a fully closed fold has to hold 1.8mm of itself, which a
    // 0.9mm radius supplies as a 1.8mm diameter.
    expect(minimumBendRadiusMm(0.9, 0)).toBeCloseTo(0.9, 10)
  })

  it('grows to clear what the fold closes over', () => {
    // The same leather folding over a 1.8mm pocket needs 3.6mm of gap.
    expect(minimumBendRadiusMm(0.9, 1.8)).toBeCloseTo(1.8, 10)
  })
})
