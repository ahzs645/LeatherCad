import type { Point } from '../../cad/cad-types'
import { dxfNumber, dxfPoints, type DxfRecord } from './dxf-parser'

export function createSplineEvaluator(record: DxfRecord): { evaluate: (t: number) => Point; spans: number[] } {
  const degree = dxfNumber(record, 71, 3)
  const points = dxfPoints(record)
  const knots = record.pairs.filter((pair) => pair.code === 40).map((pair) => Number(pair.value))
  const weights = record.pairs.filter((pair) => pair.code === 41).map((pair) => Number(pair.value))
  if (!Number.isInteger(degree) || degree < 1 || degree > 10 || points.length <= degree || knots.length !== points.length + degree + 1) {
    throw new Error('Unsupported SPLINE: valid control points, degree and knot vector are required')
  }
  if (knots.some((value, index) => !Number.isFinite(value) || (index > 0 && value < knots[index - 1])) || (weights.length && weights.length !== points.length) || weights.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Invalid SPLINE knots or rational weights')
  }
  const start = knots[degree], end = knots[points.length]
  if (!(end > start)) throw new Error('Invalid SPLINE parameter domain')
  const evaluate = (parameter: number): Point => {
    const t = Math.max(start, Math.min(end, parameter))
    let span = points.length - 1
    if (t < end) {
      span = degree
      while (span < points.length - 1 && t >= knots[span + 1]) span++
    }
    const work = Array.from({ length: degree + 1 }, (_, index) => {
      const control = span - degree + index, weight = weights[control] ?? 1
      return [points[control].x * weight, points[control].y * weight, weight]
    })
    for (let level = 1; level <= degree; level++) {
      for (let index = degree; index >= level; index--) {
        const knotIndex = span - degree + index
        const denominator = knots[knotIndex + degree - level + 1] - knots[knotIndex]
        const alpha = denominator ? (t - knots[knotIndex]) / denominator : 0
        work[index] = work[index].map((value, axis) => (1 - alpha) * work[index - 1][axis] + alpha * value)
      }
    }
    const [x, y, weight] = work[degree]
    if (Math.abs(weight) < 1e-12) throw new Error('Invalid SPLINE rational denominator')
    return { x: x / weight, y: y / weight }
  }
  return { evaluate, spans: [...new Set(knots.slice(degree, points.length + 1))] }
}
