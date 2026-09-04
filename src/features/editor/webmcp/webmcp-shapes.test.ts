import { describe, expect, it } from 'vitest'
import { buildOutline, buildStitchOutline, type OutlineParams, type OutlineSegment } from './webmcp-shapes'

function endpointsOf(segment: OutlineSegment) {
  return { start: segment.start, end: segment.end }
}

/**
 * The one property every generated outline has to hold: consecutive segments
 * share an endpoint and the last one meets the first. A ring that fails this
 * does not resolve into a closed chain, and a piece built on it cannot be cut,
 * measured or nested — so it is checked on every shape rather than spot-checked.
 */
function expectClosedRing(segments: OutlineSegment[]) {
  expect(segments.length).toBeGreaterThan(1)
  for (let index = 0; index < segments.length; index += 1) {
    const current = endpointsOf(segments[index])
    const next = endpointsOf(segments[(index + 1) % segments.length])
    expect(current.end.x).toBeCloseTo(next.start.x, 6)
    expect(current.end.y).toBeCloseTo(next.start.y, 6)
  }
}

function boundsOf(segments: OutlineSegment[]) {
  const points = segments.flatMap((segment) => [segment.start, segment.end])
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}

const base: OutlineParams = {
  kind: 'rounded_rect',
  widthMm: 90,
  heightMm: 64,
  cornerRadiusMm: 6,
  strapEnd: 'round',
  scoopMm: 12,
}

describe('buildOutline', () => {
  it.each([
    ['rounded_rect', { ...base }],
    ['square-cornered rect', { ...base, cornerRadiusMm: 0 }],
    ['circle', { ...base, kind: 'circle' as const }],
    ['round-ended strap', { ...base, kind: 'strap' as const, widthMm: 32, heightMm: 220 }],
    ['pointed strap', { ...base, kind: 'strap' as const, strapEnd: 'point' as const, widthMm: 32, heightMm: 220 }],
    ['square strap', { ...base, kind: 'strap' as const, strapEnd: 'square' as const, widthMm: 32, heightMm: 220 }],
    ['card slot', { ...base, kind: 'card_slot' as const }],
  ])('closes the ring for a %s', (_name, params) => {
    expectClosedRing(buildOutline(params))
  })

  it('sizes a rounded rectangle to the dimensions asked for', () => {
    const bounds = boundsOf(buildOutline(base))
    expect(bounds.maxX - bounds.minX).toBeCloseTo(90, 6)
    expect(bounds.maxY - bounds.minY).toBeCloseTo(64, 6)
  })

  it('places the outline around the centre it is given', () => {
    const bounds = boundsOf(buildOutline(base, { x: 120, y: -40 }))
    expect((bounds.minX + bounds.maxX) / 2).toBeCloseTo(120, 6)
    expect((bounds.minY + bounds.maxY) / 2).toBeCloseTo(-40, 6)
  })

  it('clamps a corner radius larger than the piece rather than inverting it', () => {
    const segments = buildOutline({ ...base, widthMm: 20, heightMm: 20, cornerRadiusMm: 999 })
    expectClosedRing(segments)
    const bounds = boundsOf(segments)
    expect(bounds.maxX - bounds.minX).toBeCloseTo(20, 6)
  })

  it('puts a circle arc midpoint on the circle, not at its corner', () => {
    const [top] = buildOutline({ ...base, kind: 'circle', widthMm: 50 })
    expect(top.kind).toBe('arc')
    if (top.kind !== 'arc') return
    expect(Math.hypot(top.mid.x, top.mid.y)).toBeCloseTo(25, 6)
  })

  it('dips a card slot mouth by exactly the scoop depth', () => {
    const [mouth] = buildOutline({ ...base, kind: 'card_slot', heightMm: 60, scoopMm: 10 })
    expect(mouth.kind).toBe('bezier')
    if (mouth.kind !== 'bezier') return
    // Quadratic bezier at t = 0.5.
    const midY = 0.25 * mouth.start.y + 0.5 * mouth.control.y + 0.25 * mouth.end.y
    expect(midY - mouth.start.y).toBeCloseTo(10, 6)
  })
})

describe('buildStitchOutline', () => {
  it('runs parallel to the cut edge on every side', () => {
    const outer = boundsOf(buildOutline(base))
    const inner = boundsOf(buildStitchOutline(base, 4) ?? [])
    expect(inner.minX - outer.minX).toBeCloseTo(4, 6)
    expect(outer.maxX - inner.maxX).toBeCloseTo(4, 6)
    expect(inner.minY - outer.minY).toBeCloseTo(4, 6)
    expect(outer.maxY - inner.maxY).toBeCloseTo(4, 6)
  })

  it('keeps the corner concentric by taking the inset off the radius', () => {
    const segments = buildStitchOutline(base, 4) ?? []
    expectClosedRing(segments)
    const arc = segments.find((segment) => segment.kind === 'arc')
    expect(arc).toBeDefined()
  })

  it('shrinks a round strap end with the strap', () => {
    const strap: OutlineParams = { ...base, kind: 'strap', widthMm: 30, heightMm: 200 }
    const inner = boundsOf(buildStitchOutline(strap, 5) ?? [])
    expect(inner.maxX - inner.minX).toBeCloseTo(20, 6)
    expect(inner.maxY - inner.minY).toBeCloseTo(190, 6)
  })

  it('refuses an inset that would consume the piece', () => {
    expect(buildStitchOutline({ ...base, widthMm: 10, heightMm: 10 }, 6)).toBeNull()
    expect(buildStitchOutline(base, 0)).toBeNull()
  })
})
