import type { Shape, Point } from './cad-types'
import { getShapePoints } from './cad-geometry'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GradeRule = {
  id: string
  shapeId: string
  anchor: 'start' | 'end' | 'mid' | 'control'
  deltaXPerSize: number
  deltaYPerSize: number
}

export type SizeSpec = {
  name: string
  sizeIndex: number
}

export type GradedPattern = {
  sizeName: string
  shapes: Shape[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shiftPoint(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy }
}

function shiftShape(shape: Shape, dx: number, dy: number): Shape {
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
  anchor: 'start' | 'end' | 'mid' | 'control',
  dx: number,
  dy: number,
): Shape {
  const clone = { ...shape }
  switch (anchor) {
    case 'start':
      return { ...clone, start: shiftPoint(shape.start, dx, dy) }
    case 'end':
      return { ...clone, end: shiftPoint(shape.end, dx, dy) }
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

export function gradeShapes(
  baseShapes: Shape[],
  rules: GradeRule[],
  sizes: SizeSpec[],
): GradedPattern[] {
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
      return current
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
): ('start' | 'end' | 'mid' | 'control')[] {
  switch (shape.type) {
    case 'line':
      return ['start', 'end']
    case 'arc':
      return ['start', 'mid', 'end']
    case 'bezier':
      return ['start', 'control', 'end']
    case 'text':
      return ['start', 'end']
  }
}

function getAnchorPointForRule(
  shape: Shape,
  anchor: 'start' | 'end' | 'mid' | 'control',
): Point {
  if (anchor === 'start') return shape.start
  if (anchor === 'end') return shape.end
  if (anchor === 'mid' && shape.type === 'arc') return shape.mid
  if (anchor === 'control' && shape.type === 'bezier') return shape.control
  return shape.start
}

// ---------------------------------------------------------------------------
// nestGradedPatterns – simple horizontal stacking
// ---------------------------------------------------------------------------

export function nestGradedPatterns(
  patterns: GradedPattern[],
  spacingMm: number,
): GradedPattern[] {
  if (patterns.length === 0) return []

  let currentX = 0
  const result: GradedPattern[] = []

  for (const pattern of patterns) {
    // Compute bounding box
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    for (const shape of pattern.shapes) {
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
    const shapes = pattern.shapes.map((s) => shiftShape(s, dx, 0))

    result.push({ sizeName: pattern.sizeName, shapes })

    const width = maxX - minX
    currentX += width + spacingMm
  }

  return result
}
