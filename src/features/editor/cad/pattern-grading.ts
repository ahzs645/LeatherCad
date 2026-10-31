import type { Shape, Point } from './cad-types'
import { getShapePoints } from './cad-geometry'
import { isNativeCurve, nativeCurveBounds, transformNativeCurve } from './native-curve-ops'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GradeAnchor = 'start' | 'end' | 'mid' | 'control' | 'control1' | 'control2' | 'center' | 'radius-x' | 'radius-y'
export type GradeRule = {
  id: string
  shapeId: string
  anchor: GradeAnchor
  deltaXPerSize: number
  deltaYPerSize: number
}

export type SizeSpec = {
  name: string
  sizeIndex: number
}

export type GradedPattern<T extends Shape = Shape> = {
  sizeName: string
  shapes: T[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shiftPoint(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy }
}

function shiftShape(shape: Shape, dx: number, dy: number): Shape {
  if (shape.type === 'ellipse') return { ...shape, center: shiftPoint(shape.center, dx, dy) }
  if (isNativeCurve(shape)) return transformNativeCurve(shape, [1, 0, 0, 1, dx, dy])
  switch (shape.type) {
    case 'line':
      return {
        ...shape,
        start: shiftPoint(shape.start, dx, dy),
        end: shiftPoint(shape.end, dx, dy),
      }
    case 'arc':
      return {
        ...shape,
        start: shiftPoint(shape.start, dx, dy),
        mid: shiftPoint(shape.mid, dx, dy),
        end: shiftPoint(shape.end, dx, dy),
      }
    case 'bezier':
      return {
        ...shape,
        start: shiftPoint(shape.start, dx, dy),
        control: shiftPoint(shape.control, dx, dy),
        end: shiftPoint(shape.end, dx, dy),
      }
    case 'text':
      return {
        ...shape,
        start: shiftPoint(shape.start, dx, dy),
        end: shiftPoint(shape.end, dx, dy),
      }
  }
}

function applyAnchorShift(
  shape: Shape,
  anchor: GradeAnchor,
  dx: number,
  dy: number,
): Shape {
  const clone = { ...shape }
  if (shape.type === 'ellipse') {
    if (anchor === 'center') return { ...shape, center: shiftPoint(shape.center, dx, dy) }
    if (anchor === 'radius-x' || anchor === 'radius-y') {
      const radiusX = shape.radiusX + (anchor === 'radius-x' ? dx : 0), radiusY = shape.radiusY + (anchor === 'radius-y' ? dy : 0)
      if (!(radiusX > 0 && radiusY > 0)) throw new Error('Grading would collapse an ellipse radius. Reduce the size increment.')
      return { ...shape, radiusX, radiusY }
    }
    return clone
  }
  switch (anchor) {
    case 'start':
      return { ...shape, start: shiftPoint(shape.start, dx, dy) }
    case 'end':
      return { ...shape, end: shiftPoint(shape.end, dx, dy) }
    case 'control1':
    case 'control2':
      return shape.type === 'cubic' ? { ...shape, [anchor]: shiftPoint(shape[anchor], dx, dy) } : clone
    case 'center':
    case 'radius-x':
    case 'radius-y':
      return clone
    case 'mid':
      if (shape.type === 'arc') {
        return { ...shape, mid: shiftPoint(shape.mid, dx, dy) }
      }
      return clone
    case 'control':
      if (shape.type === 'bezier') {
        return { ...shape, control: shiftPoint(shape.control, dx, dy) }
      }
      if (shape.type === 'arc') {
        return { ...shape, mid: shiftPoint(shape.mid, dx, dy) }
      }
      return clone
  }
}

// ---------------------------------------------------------------------------
// gradeShapes
// ---------------------------------------------------------------------------

export function gradeShapes<T extends Shape>(
  baseShapes: T[],
  rules: GradeRule[],
  sizes: SizeSpec[],
): GradedPattern<T>[] {
  // Index rules by shapeId for fast lookup
  const rulesByShape = new Map<string, GradeRule[]>()
  for (const rule of rules) {
    let list = rulesByShape.get(rule.shapeId)
    if (!list) {
      list = []
      rulesByShape.set(rule.shapeId, list)
    }
    list.push(rule)
  }

  return sizes.map((size) => {
    const shapes = baseShapes.map((shape) => {
      let current: Shape = { ...shape }
      const shapeRules = rulesByShape.get(shape.id) ?? []
      for (const rule of shapeRules) {
        const dx = rule.deltaXPerSize * size.sizeIndex
        const dy = rule.deltaYPerSize * size.sizeIndex
        current = applyAnchorShift(current, rule.anchor, dx, dy)
      }
      // Anchor grading preserves the shape's discriminant and analytic representation.
      return current as T
    })
    return { sizeName: size.name, shapes }
  })
}

// ---------------------------------------------------------------------------
// buildDefaultGradeRules – uniform scaling from centroid
// ---------------------------------------------------------------------------

export function buildDefaultGradeRules(shapes: Shape[]): GradeRule[] {
  // Compute centroid of all shape points
  let totalX = 0
  let totalY = 0
  let count = 0
  for (const shape of shapes) {
    for (const pt of getShapePoints(shape)) {
      totalX += pt.x
      totalY += pt.y
      count++
    }
  }

  if (count === 0) return []

  const cx = totalX / count
  const cy = totalY / count

  // Default: 1mm per size increment per 100mm distance from centroid
  const scaleFactor = 1 / 100

  const rules: GradeRule[] = []
  let ruleIndex = 0

  for (const shape of shapes) {
    if (shape.type === 'ellipse') {
      rules.push({ id: `grade-rule-${ruleIndex++}`, shapeId: shape.id, anchor: 'center', deltaXPerSize: (shape.center.x - cx) * scaleFactor, deltaYPerSize: (shape.center.y - cy) * scaleFactor },
        { id: `grade-rule-${ruleIndex++}`, shapeId: shape.id, anchor: 'radius-x', deltaXPerSize: shape.radiusX * scaleFactor, deltaYPerSize: 0 },
        { id: `grade-rule-${ruleIndex++}`, shapeId: shape.id, anchor: 'radius-y', deltaXPerSize: 0, deltaYPerSize: shape.radiusY * scaleFactor })
      continue
    }
    const anchors = getAnchorsForShape(shape)
    for (const anchor of anchors) {
      const pt = getAnchorPointForRule(shape, anchor)
      const dx = (pt.x - cx) * scaleFactor
      const dy = (pt.y - cy) * scaleFactor
      rules.push({
        id: `grade-rule-${ruleIndex++}`,
        shapeId: shape.id,
        anchor,
        deltaXPerSize: dx,
        deltaYPerSize: dy,
      })
    }
  }

  return rules
}

function getAnchorsForShape(
  shape: Shape,
): GradeAnchor[] {
  switch (shape.type) {
    case 'line':
      return ['start', 'end']
    case 'arc':
      return ['start', 'mid', 'end']
    case 'bezier':
      return ['start', 'control', 'end']
    case 'cubic':
      return ['start', 'control1', 'control2', 'end']
    case 'ellipse':
      return ['center', 'radius-x', 'radius-y']
    case 'text':
      return ['start', 'end']
  }
}

function getAnchorPointForRule(
  shape: Shape,
  anchor: GradeAnchor,
): Point {
  if (shape.type === 'ellipse') return shape.center
  if ((anchor === 'control1' || anchor === 'control2') && shape.type === 'cubic') return shape[anchor]
  if (anchor === 'start') return shape.start
  if (anchor === 'end') return shape.end
  if (anchor === 'mid' && shape.type === 'arc') return shape.mid
  if (anchor === 'control' && shape.type === 'bezier') return shape.control
  return shape.start
}

// ---------------------------------------------------------------------------
// nestGradedPatterns – simple horizontal stacking
// ---------------------------------------------------------------------------

export function nestGradedPatterns<T extends Shape>(
  patterns: GradedPattern<T>[],
  spacingMm: number,
): GradedPattern<T>[] {
  if (patterns.length === 0) return []

  let currentX = 0
  const result: GradedPattern<T>[] = []

  for (const pattern of patterns) {
    // Compute bounding box
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    for (const shape of pattern.shapes) {
      if (isNativeCurve(shape)) {
        const bounds = nativeCurveBounds(shape)
        minX = Math.min(minX, bounds.minX); maxX = Math.max(maxX, bounds.maxX)
        minY = Math.min(minY, bounds.minY); maxY = Math.max(maxY, bounds.maxY)
        continue
      }
      for (const pt of getShapePoints(shape)) {
        if (pt.x < minX) minX = pt.x
        if (pt.x > maxX) maxX = pt.x
        if (pt.y < minY) minY = pt.y
        if (pt.y > maxY) maxY = pt.y
      }
    }

    if (!isFinite(minX)) {
      result.push(pattern)
      continue
    }

    // Shift so pattern's left edge is at currentX
    const dx = currentX - minX
    const shapes = pattern.shapes.map((s) => shiftShape(s, dx, 0) as T)

    result.push({ sizeName: pattern.sizeName, shapes })

    const width = maxX - minX
    currentX += width + spacingMm
  }

  return result
}
