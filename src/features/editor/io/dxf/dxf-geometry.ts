import type { Point } from '../../cad/cad-types'

export type DxfMatrix = [number, number, number, number, number, number]
export const IDENTITY: DxfMatrix = [1, 0, 0, 1, 0, 0]
export const TAU = Math.PI * 2

export function transformPoint(matrix: DxfMatrix, point: Point): Point {
  const [a, b, c, d, e, f] = matrix
  const result = { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f }
  if (!Number.isFinite(result.x) || !Number.isFinite(result.y) || Math.max(Math.abs(result.x), Math.abs(result.y)) > 1e9) {
    throw new Error('DXF coordinates exceed the supported range')
  }
  return result
}

export function multiplyMatrices(a: DxfMatrix, b: DxfMatrix): DxfMatrix {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

export function isSimilarity(matrix: DxfMatrix): boolean {
  const [a, b, c, d] = matrix
  const xLength = Math.hypot(a, b), yLength = Math.hypot(c, d)
  return Math.abs(xLength - yLength) <= 1e-8 * Math.max(xLength, yLength, 1) && Math.abs(a * c + b * d) <= 1e-8 * Math.max(xLength * yLength, 1)
}

function lineDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x, dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared < 1e-20) return Math.hypot(point.x - start.x, point.y - start.y)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy)
}

export function sampleCurve(evaluate: (t: number) => Point, from: number, to: number, tolerance: number): Point[] {
  const result = [evaluate(from)]
  const visit = (a: number, b: number, start: Point, end: Point, depth: number) => {
    if (result.length >= 4096) throw new Error('DXF curve exceeds the 4096 segment import limit')
    const quarter = evaluate(a + (b - a) / 4), middle = evaluate((a + b) / 2), threeQuarter = evaluate(a + (b - a) * 3 / 4)
    const error = Math.max(lineDistance(quarter, start, end), lineDistance(middle, start, end), lineDistance(threeQuarter, start, end))
    if (depth >= 14 && error > tolerance) throw new Error('DXF curve could not be flattened within the requested tolerance')
    if (error <= tolerance) result.push(end)
    else {
      visit(a, (a + b) / 2, start, middle, depth + 1)
      visit((a + b) / 2, b, middle, end, depth + 1)
    }
  }
  visit(from, to, result[0], evaluate(to), 0)
  return result
}

export function bulgeArc(start: Point, end: Point, bulge: number): { center: Point; radius: number; angle: number; sweep: number } | null {
  const length = Math.hypot(end.x - start.x, end.y - start.y)
  if (Math.abs(bulge) < 1e-10 || length < 1e-10) return null
  const offset = length * (1 - bulge * bulge) / (4 * bulge)
  const center = { x: (start.x + end.x) / 2 - (end.y - start.y) / length * offset, y: (start.y + end.y) / 2 + (end.x - start.x) / length * offset }
  return { center, radius: Math.hypot(start.x - center.x, start.y - center.y), angle: Math.atan2(start.y - center.y, start.x - center.x), sweep: 4 * Math.atan(bulge) }
}
