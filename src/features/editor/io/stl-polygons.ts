import ClipperLib from 'clipper-lib'
import type { Point } from '../cad/cad-types'

const SCALE = 10_000
const EPSILON = 1 / SCALE
export type StlRegion = { outer: Point[]; holes: Point[][] }

export function signedArea(points: Point[]) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]
    return area + point.x * next.y - next.x * point.y
  }, 0) / 2
}

function cross(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

export function cleanRing(points: Point[]): Point[] {
  let result = points.map((point) => ({
    x: Math.round(point.x * SCALE) / SCALE,
    y: Math.round(point.y * SCALE) / SCALE,
  }))
  result = result.filter((point, index) => {
    const previous = result[(index + result.length - 1) % result.length]
    return Math.hypot(point.x - previous.x, point.y - previous.y) >= EPSILON
  })
  let changed = true
  while (changed && result.length >= 3) {
    changed = false
    result = result.filter((point, index) => {
      const a = result[(index + result.length - 1) % result.length]
      const b = result[(index + 1) % result.length]
      const redundant = Math.abs(cross(a, point, b)) < 1e-10 &&
        (point.x - a.x) * (point.x - b.x) + (point.y - a.y) * (point.y - b.y) <= 0
      changed ||= redundant
      return !redundant
    })
  }
  return result
}

function onSegment(point: Point, a: Point, b: Point) {
  return Math.abs(cross(a, b, point)) < 1e-9 &&
    point.x >= Math.min(a.x, b.x) - EPSILON && point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON && point.y <= Math.max(a.y, b.y) + EPSILON
}

export function containsPoint(ring: Point[], point: Point): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if (onSegment(point, a, b)) return true
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b)
  return (abC * abD < 0 && cdA * cdB < 0) ||
    onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b)
}

export function validateRing(ring: Point[]) {
  if (ring.length < 3 || Math.abs(signedArea(ring)) < 1e-6) {
    throw new Error('An outline has no printable area. Remove zero-length or overlapping edges.')
  }
  if (ring.length > 5_000) throw new Error('An outline is too complex for STL export (maximum 5,000 sampled vertices).')
  for (let i = 0; i < ring.length; i++) {
    for (let j = i + 2; j < ring.length; j++) {
      if (i === 0 && j === ring.length - 1) continue
      if (segmentsIntersect(ring[i], ring[(i + 1) % ring.length], ring[j], ring[(j + 1) % ring.length])) {
        throw new Error('An outline crosses or touches itself. Repair its intersections before STL export.')
      }
    }
  }
}

function toPath(ring: Point[]) {
  return ring.map((point) => ({ X: Math.round(point.x * SCALE), Y: Math.round(point.y * SCALE) }))
}

function fromPath(ring: ClipperLib.IntPoint[]) {
  return cleanRing(ring.map((point) => ({ x: point.X / SCALE, y: point.Y / SCALE })))
}

/** Classifies nested cut loops by containment, independent of authored winding. */
export function orientNestedRings(rings: Point[][]): Point[][] {
  return rings.map((ring, index) => {
    const area = Math.abs(signedArea(ring))
    const depth = rings.filter((other, otherIndex) => otherIndex !== index &&
      Math.abs(signedArea(other)) > area + EPSILON && ring.every((point) => containsPoint(other, point))).length
    const positive = depth % 2 === 0
    return (signedArea(ring) > 0) === positive ? ring : [...ring].reverse()
  })
}

export function clipRings(subject: Point[][], clips: Point[][] = [], difference = false): Point[][] {
  const clipper = new ClipperLib.Clipper()
  clipper.AddPaths(subject.map(toPath), ClipperLib.PolyType.ptSubject, true)
  if (clips.length) clipper.AddPaths(clips.map(toPath), ClipperLib.PolyType.ptClip, true)
  const solution: ClipperLib.IntPoint[][] = []
  clipper.Execute(difference ? ClipperLib.ClipType.ctDifference : ClipperLib.ClipType.ctUnion,
    solution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  return solution.map(fromPath).filter((ring) => ring.length >= 3 && Math.abs(signedArea(ring)) > 1e-6)
}

export function intersectRings(subject: Point[][], clips: Point[][]): Point[][] {
  const clipper = new ClipperLib.Clipper()
  clipper.AddPaths(subject.map(toPath), ClipperLib.PolyType.ptSubject, true)
  clipper.AddPaths(clips.map(toPath), ClipperLib.PolyType.ptClip, true)
  const solution: ClipperLib.IntPoint[][] = []
  clipper.Execute(ClipperLib.ClipType.ctIntersection, solution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  return solution.map(fromPath).filter((ring) => ring.length >= 3 && Math.abs(signedArea(ring)) > 1e-6)
}

export function offsetRings(rings: Point[][], amountMm: number, toleranceMm = 0.02): Point[][] {
  if (amountMm === 0) return rings
  const offset = new ClipperLib.ClipperOffset(2, toleranceMm * SCALE)
  offset.AddPaths(rings.map(toPath), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon)
  const solution: ClipperLib.IntPoint[][] = []
  offset.Execute(solution, amountMm * SCALE)
  return solution.map(fromPath).filter((ring) => ring.length >= 3)
}

export function regionsFromRings(rings: Point[][]): StlRegion[] {
  const outers = rings.filter((ring) => signedArea(ring) > 0).map((outer) => ({ outer, holes: [] as Point[][] }))
  for (const hole of rings.filter((ring) => signedArea(ring) < 0)) {
    const container = outers.filter((region) => containsPoint(region.outer, hole[0]))
      .sort((a, b) => Math.abs(signedArea(a.outer)) - Math.abs(signedArea(b.outer)))[0]
    if (!container) throw new Error('A cutout could not be matched to an outer outline.')
    container.holes.push(hole)
  }
  return outers
}

export function inMaterial(rings: Point[][], point: Point) {
  return rings.reduce((winding, ring) => winding + (containsPoint(ring, point) ? Math.sign(signedArea(ring)) : 0), 0) > 0
}
