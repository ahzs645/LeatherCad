import { Vector2 } from 'three'
import type { FoldLine, Point } from '../cad/cad-types'
import { clipPolygonByLine, sideOfLine, type Bounds2 } from './bridge/geometry-utils'
import type { FinalProductDiagnostic, FoldHinge, FoldPanel } from './final-product-types'
import type { OutlinePolygon } from './three-bridge-types'

const AREA_EPSILON = 1e-4
const LINE_EPSILON = 1e-5
const OVERLAP_EPSILON = 1e-4

export type FinalProductPanelGraphInput = {
  foldLines: FoldLine[]
  regions?: Array<{ layerId: string; polygon: Point[] }>
  outlinePolygons?: OutlinePolygon[]
  documentBounds: Bounds2
}

export type FinalProductPanelGraph = {
  panels: FoldPanel[]
  hinges: FoldHinge[]
  diagnostics: FinalProductDiagnostic[]
}

function toVector(point: Point) {
  return new Vector2(point.x, point.y)
}

function toPoint(point: Vector2): Point {
  return { x: point.x, y: point.y }
}

export function polygonArea(points: Point[]) {
  if (points.length < 3) return 0
  let sum = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    sum += current.x * next.y - next.x * current.y
  }
  return Math.abs(sum) / 2
}

function normalizePolygon(points: Point[]) {
  if (points.length <= 1) return points
  const result: Point[] = []
  for (const point of points) {
    const previous = result[result.length - 1]
    if (!previous || Math.hypot(previous.x - point.x, previous.y - point.y) > LINE_EPSILON) {
      result.push(point)
    }
  }
  const first = result[0]
  const last = result[result.length - 1]
  if (first && last && Math.hypot(first.x - last.x, first.y - last.y) <= LINE_EPSILON) {
    result.pop()
  }
  return result
}

function centroid(points: Point[]) {
  if (points.length === 0) return { x: 0, y: 0 }
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  }
}

function baseRegions(
  regions: Array<{ layerId: string; polygon: Point[] }> | undefined,
  outlinePolygons: OutlinePolygon[] | undefined,
  documentBounds: Bounds2,
) {
  const physicalRegions = (regions ?? [])
    .map((region, index) => ({
      layerId: region.layerId,
      polygon: normalizePolygon(region.polygon),
      id: `physical-region-${index + 1}`,
    }))
    .filter((region) => polygonArea(region.polygon) > AREA_EPSILON)

  if (physicalRegions.length > 0) {
    return physicalRegions
  }

  const outlines = (outlinePolygons ?? [])
    .map((outline, index) => ({
      layerId: outline.layerId,
      polygon: normalizePolygon(outline.polygon),
      id: `region-${index + 1}`,
    }))
    .filter((region) => polygonArea(region.polygon) > AREA_EPSILON)

  if (outlines.length > 0) {
    return outlines
  }

  return [{
    id: 'document-region',
    layerId: '__document__',
    polygon: [
      { x: documentBounds.minX, y: documentBounds.minY },
      { x: documentBounds.maxX, y: documentBounds.minY },
      { x: documentBounds.maxX, y: documentBounds.maxY },
      { x: documentBounds.minX, y: documentBounds.maxY },
    ],
  }]
}

function splitPanel(panel: FoldPanel, foldLine: FoldLine) {
  const lineStart = toVector(foldLine.start)
  const lineEnd = toVector(foldLine.end)
  if (lineStart.distanceToSquared(lineEnd) <= LINE_EPSILON * LINE_EPSILON) {
    return [panel]
  }

  const polygon = panel.polygon.map(toVector)
  const positive = normalizePolygon(clipPolygonByLine(polygon, lineStart, lineEnd, true).map(toPoint))
  const negative = normalizePolygon(clipPolygonByLine(polygon, lineStart, lineEnd, false).map(toPoint))

  if (polygonArea(positive) <= AREA_EPSILON || polygonArea(negative) <= AREA_EPSILON) {
    return [panel]
  }

  return [
    {
      ...panel,
      id: `${panel.id}-a`,
      polygon: positive,
      areaMm2: polygonArea(positive),
    },
    {
      ...panel,
      id: `${panel.id}-b`,
      polygon: negative,
      areaMm2: polygonArea(negative),
    },
  ]
}

function pointLineParameter(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= LINE_EPSILON * LINE_EPSILON) {
    return 0
  }
  return ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
}

function lineIntersection(a: Point, b: Point, sideA: number, sideB: number) {
  const denominator = sideA - sideB
  if (Math.abs(denominator) <= LINE_EPSILON) {
    return null
  }
  const t = sideA / denominator
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  }
}

function foldTouchRange(panel: FoldPanel, foldLine: FoldLine) {
  const start = toVector(foldLine.start)
  const end = toVector(foldLine.end)
  const samples: number[] = []

  for (let index = 0; index < panel.polygon.length; index += 1) {
    const current = panel.polygon[index]
    const next = panel.polygon[(index + 1) % panel.polygon.length]
    const currentSide = sideOfLine(toVector(current), start, end)
    const nextSide = sideOfLine(toVector(next), start, end)

    if (Math.abs(currentSide) <= LINE_EPSILON) {
      samples.push(pointLineParameter(current, foldLine.start, foldLine.end))
    }
    if (currentSide * nextSide < -LINE_EPSILON) {
      const crossing = lineIntersection(current, next, currentSide, nextSide)
      if (crossing) {
        samples.push(pointLineParameter(crossing, foldLine.start, foldLine.end))
      }
    }
    if (Math.abs(currentSide) <= LINE_EPSILON && Math.abs(nextSide) <= LINE_EPSILON) {
      samples.push(pointLineParameter(next, foldLine.start, foldLine.end))
    }
  }

  if (samples.length < 2) {
    return null
  }

  const min = Math.max(0, Math.min(...samples))
  const max = Math.min(1, Math.max(...samples))
  if (max - min <= OVERLAP_EPSILON) {
    return null
  }
  return { min, max }
}

function rangesOverlap(left: { min: number; max: number }, right: { min: number; max: number }) {
  return Math.min(left.max, right.max) - Math.max(left.min, right.min)
}

function panelSide(panel: FoldPanel, foldLine: FoldLine) {
  const center = centroid(panel.polygon)
  return sideOfLine(toVector(center), toVector(foldLine.start), toVector(foldLine.end))
}

export function buildFinalProductPanelGraph({
  foldLines,
  regions,
  outlinePolygons,
  documentBounds,
}: FinalProductPanelGraphInput): FinalProductPanelGraph {
  const diagnostics: FinalProductDiagnostic[] = []
  let panels: FoldPanel[] = baseRegions(regions, outlinePolygons, documentBounds).map((region, index) => ({
    id: `panel-${index + 1}`,
    layerId: region.layerId,
    polygon: region.polygon,
    areaMm2: polygonArea(region.polygon),
  }))

  for (const foldLine of foldLines) {
    panels = panels.flatMap((panel) => splitPanel(panel, foldLine))
  }

  panels = panels.map((panel, index) => ({
    ...panel,
    id: `panel-${index + 1}`,
    areaMm2: polygonArea(panel.polygon),
  }))

  const hinges: FoldHinge[] = []
  for (const foldLine of foldLines) {
    const positivePanels: Array<{ panel: FoldPanel; range: { min: number; max: number } }> = []
    const negativePanels: Array<{ panel: FoldPanel; range: { min: number; max: number } }> = []

    for (const panel of panels) {
      const range = foldTouchRange(panel, foldLine)
      if (!range) {
        continue
      }
      const side = panelSide(panel, foldLine)
      if (side >= 0) {
        positivePanels.push({ panel, range })
      } else {
        negativePanels.push({ panel, range })
      }
    }

    let hingeCount = 0
    for (const positive of positivePanels) {
      for (const negative of negativePanels) {
        if (rangesOverlap(positive.range, negative.range) <= OVERLAP_EPSILON) {
          continue
        }
        const angleDeg = foldLine.angleDeg
        const directionSign = foldLine.direction === 'valley' ? -1 : 1
        hinges.push({
          id: `hinge-${hinges.length + 1}`,
          foldLine,
          fromPanelId: negative.panel.id,
          toPanelId: positive.panel.id,
          angleDeg,
          signedAngleDeg: angleDeg * directionSign,
        })
        hingeCount += 1
      }
    }

    if (hingeCount === 0) {
      diagnostics.push({
        id: `fold-line-unresolved-${foldLine.id}`,
        code: 'fold-line-unresolved',
        severity: 'warning',
        message: `Fold line ${foldLine.name} did not split any panel into a hinge.`,
        foldLineIds: [foldLine.id],
      })
    }
  }

  if (foldLines.length > 0 && panels.length === 1) {
    diagnostics.push({
      id: 'panel-graph-unsplit',
      code: 'panel-graph-unsplit',
      severity: 'warning',
      message: 'Fold lines are present, but the final product panel graph still has one panel.',
      foldLineIds: foldLines.map((foldLine) => foldLine.id),
    })
  }

  return { panels, hinges, diagnostics }
}

export function findPanelContainingPoint(panels: FoldPanel[], point: Point) {
  let best: FoldPanel | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const panel of panels) {
    let inside = false
    for (let index = 0, previousIndex = panel.polygon.length - 1; index < panel.polygon.length; previousIndex = index, index += 1) {
      const current = panel.polygon[index]
      const previous = panel.polygon[previousIndex]
      const intersects = ((current.y > point.y) !== (previous.y > point.y)) &&
        point.x < ((previous.x - current.x) * (point.y - current.y)) / ((previous.y - current.y) || 1e-9) + current.x
      if (intersects) {
        inside = !inside
      }
    }
    if (inside) {
      return panel
    }

    const center = centroid(panel.polygon)
    const candidateDistance = Math.hypot(center.x - point.x, center.y - point.y)
    if (candidateDistance < bestDistance) {
      best = panel
      bestDistance = candidateDistance
    }
  }

  return best
}
