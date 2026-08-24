import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { MIN_PLATE_VIEW_ALIGNMENT, ORBIT_OFFSET_RATIOS, plateViewAlignment } from './engine-runtime'

/** The world up, which is also the normal of a flat pattern lying on the grid. */
const FLAT = new Vector3(0, 1, 0)

describe('framing a flat layout', () => {
  it('sees an untilted pattern square enough to frame it', () => {
    // The model root is not tilted, so a placed layout lies in the grid plane
    // and the default three-quarter view looks down onto it.
    const alignment = plateViewAlignment(ORBIT_OFFSET_RATIOS, FLAT)

    expect(alignment).toBeGreaterThan(MIN_PLATE_VIEW_ALIGNMENT)
    expect(alignment).toBeCloseTo(0.581, 3)
  })

  it('would have been all but edge-on with the 40-degree model tilt', () => {
    // The tilt this replaced was -0.7 rad on the model root, which swung the
    // plate's normal to meet the camera direction at about a degree: a
    // correctly placed layout framed itself as a hairline, and the guard below
    // had to kick the camera back off the plane every time.
    const tilted = new Vector3(0, Math.cos(-0.7), Math.sin(-0.7))

    const alignment = plateViewAlignment(ORBIT_OFFSET_RATIOS, tilted)

    expect(Math.abs(alignment)).toBeLessThan(MIN_PLATE_VIEW_ALIGNMENT)
    expect(Math.abs(alignment)).toBeCloseTo(0.021, 3)
  })

  it('still catches a plate turned edge-on to the camera', () => {
    // Edge-on means the plate's normal is perpendicular to where the camera is
    // looking from, so the camera sees the sheet's thickness and nothing else.
    const edgeOn = ORBIT_OFFSET_RATIOS.clone().normalize().cross(new Vector3(0, 1, 0)).normalize()

    expect(Math.abs(plateViewAlignment(ORBIT_OFFSET_RATIOS, edgeOn))).toBeCloseTo(0, 6)
    expect(Math.abs(plateViewAlignment(ORBIT_OFFSET_RATIOS, edgeOn))).toBeLessThan(MIN_PLATE_VIEW_ALIGNMENT)
  })
})
