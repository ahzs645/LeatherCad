import { uid } from '../../cad/cad-geometry'
import type { DimensionLine, Point } from '../../cad/cad-types'
import type { RawDimensionSegment, RawDimensionText } from './lcc-types'

function nearlyEqual(a: number, b: number, tolerance = 0.35): boolean {
  return Math.abs(a - b) <= tolerance
}

function pointsNear(a: Point, b: Point, tolerance = 0.35): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= tolerance
}

function segmentLength(segment: RawDimensionSegment) {
  return Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y)
}

function componentBounds(segments: RawDimensionSegment[]) {
  const xs = segments.flatMap((segment) => [segment.start.x, segment.end.x])
  const ys = segments.flatMap((segment) => [segment.start.y, segment.end.y])
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

function distanceToBounds(point: Point, bounds: ReturnType<typeof componentBounds>) {
  const dx = point.x < bounds.minX ? bounds.minX - point.x : point.x > bounds.maxX ? point.x - bounds.maxX : 0
  const dy = point.y < bounds.minY ? bounds.minY - point.y : point.y > bounds.maxY ? point.y - bounds.maxY : 0
  return Math.hypot(dx, dy)
}

function segmentTouchesComponent(segment: RawDimensionSegment, component: RawDimensionSegment[], tolerance = 0.35) {
  return component.some((existing) =>
    pointsNear(segment.start, existing.start, tolerance) ||
    pointsNear(segment.start, existing.end, tolerance) ||
    pointsNear(segment.end, existing.start, tolerance) ||
    pointsNear(segment.end, existing.end, tolerance),
  )
}

function clusterDimensionSegments(segments: RawDimensionSegment[]) {
  const components: RawDimensionSegment[][] = []

  for (const segment of segments) {
    const matches = components.flatMap((component, index) => (segmentTouchesComponent(segment, component) ? [index] : []))
    if (matches.length === 0) {
      components.push([segment])
      continue
    }

    const [targetIndex, ...rest] = matches
    components[targetIndex].push(segment)

    for (let index = rest.length - 1; index >= 0; index -= 1) {
      const sourceIndex = rest[index]
      components[targetIndex].push(...components[sourceIndex])
      components.splice(sourceIndex, 1)
    }
  }

  return components
}

type DimensionComponentAnalysis = {
  orientation: 'horizontal' | 'vertical'
  axisCoord: number
  spanMin: number
  spanMax: number
  layerId: string
}

function analyzeDimensionComponent(component: RawDimensionSegment[]): DimensionComponentAnalysis | null {
  if (component.length === 0) {
    return null
  }

  const arrowSegments = component.filter((segment) => segment.hasArrowStart || segment.hasArrowEnd)
  const axisSegments = arrowSegments.length > 0 ? arrowSegments : component
  const horizontalWeight = axisSegments.reduce((sum, segment) => sum + Math.abs(segment.end.x - segment.start.x), 0)
  const verticalWeight = axisSegments.reduce((sum, segment) => sum + Math.abs(segment.end.y - segment.start.y), 0)
  const orientation = horizontalWeight >= verticalWeight ? 'horizontal' : 'vertical'
  const axisCoord =
    orientation === 'horizontal'
      ? axisSegments.reduce((sum, segment) => sum + (segment.start.y + segment.end.y) / 2, 0) / axisSegments.length
      : axisSegments.reduce((sum, segment) => sum + (segment.start.x + segment.end.x) / 2, 0) / axisSegments.length
  const spanValues =
    orientation === 'horizontal'
      ? axisSegments.flatMap((segment) => [segment.start.x, segment.end.x])
      : axisSegments.flatMap((segment) => [segment.start.y, segment.end.y])

  return {
    orientation,
    axisCoord,
    spanMin: Math.min(...spanValues),
    spanMax: Math.max(...spanValues),
    layerId: component[0].layerId,
  }
}

function mergeSplitDimensionComponents(components: RawDimensionSegment[][], texts: RawDimensionText[]) {
  const merged = [...components]
  let didMerge = true

  while (didMerge) {
    didMerge = false
    for (let leftIndex = 0; leftIndex < merged.length; leftIndex += 1) {
      const leftAnalysis = analyzeDimensionComponent(merged[leftIndex])
      if (!leftAnalysis) continue

      for (let rightIndex = leftIndex + 1; rightIndex < merged.length; rightIndex += 1) {
        const rightAnalysis = analyzeDimensionComponent(merged[rightIndex])
        if (!rightAnalysis) continue
        if (
          leftAnalysis.layerId !== rightAnalysis.layerId ||
          leftAnalysis.orientation !== rightAnalysis.orientation ||
          !nearlyEqual(leftAnalysis.axisCoord, rightAnalysis.axisCoord, 0.5)
        ) {
          continue
        }

        const spanStart = Math.min(leftAnalysis.spanMin, rightAnalysis.spanMin)
        const spanEnd = Math.max(leftAnalysis.spanMax, rightAnalysis.spanMax)
        const gapStart = Math.min(Math.max(leftAnalysis.spanMin, rightAnalysis.spanMin), Math.min(leftAnalysis.spanMax, rightAnalysis.spanMax))
        const gapEnd = Math.max(Math.max(leftAnalysis.spanMin, rightAnalysis.spanMin), Math.min(leftAnalysis.spanMax, rightAnalysis.spanMax))
        const hasBridgingText = texts.some((text) => {
          if (text.layerId !== leftAnalysis.layerId) return false
          const axisDistance =
            leftAnalysis.orientation === 'horizontal'
              ? Math.abs(text.center.y - leftAnalysis.axisCoord)
              : Math.abs(text.center.x - leftAnalysis.axisCoord)
          const projection = leftAnalysis.orientation === 'horizontal' ? text.center.x : text.center.y
          return axisDistance <= 8 && projection >= gapStart - 4 && projection <= gapEnd + 4 && projection >= spanStart - 4 && projection <= spanEnd + 4
        })

        if (!hasBridgingText) continue
        merged[leftIndex] = [...merged[leftIndex], ...merged[rightIndex]]
        merged.splice(rightIndex, 1)
        didMerge = true
        break
      }

      if (didMerge) break
    }
  }

  return merged
}

export function rebuildImportedDimensions(segments: RawDimensionSegment[], texts: RawDimensionText[]): DimensionLine[] {
  if (segments.length === 0 && texts.length === 0) {
    return []
  }

  const components = mergeSplitDimensionComponents(clusterDimensionSegments(segments), texts)
  const remainingTexts = [...texts]

  const built = components
    .map<DimensionLine | null>((component) => {
      const analysis = analyzeDimensionComponent(component)
      if (!analysis) return null
      const { orientation, axisCoord } = analysis
      const arrowSegments = component.filter((segment) => segment.hasArrowStart || segment.hasArrowEnd)

      const measuredPoints = component
        .map((segment) => {
          if (orientation === 'horizontal') {
            const startDistance = Math.abs(segment.start.y - axisCoord)
            const endDistance = Math.abs(segment.end.y - axisCoord)
            const onAxis = startDistance <= endDistance ? segment.start : segment.end
            const measured = startDistance <= endDistance ? segment.end : segment.start
            if (!nearlyEqual(onAxis.y, axisCoord) || nearlyEqual(measured.y, axisCoord)) {
              return null
            }
            return measured
          }

          const startDistance = Math.abs(segment.start.x - axisCoord)
          const endDistance = Math.abs(segment.end.x - axisCoord)
          const onAxis = startDistance <= endDistance ? segment.start : segment.end
          const measured = startDistance <= endDistance ? segment.end : segment.start
          if (!nearlyEqual(onAxis.x, axisCoord) || nearlyEqual(measured.x, axisCoord)) {
            return null
          }
          return measured
        })
        .filter((point): point is Point => point !== null)
        .filter((point, index, all) => all.findIndex((entry) => pointsNear(entry, point)) === index)

      if (measuredPoints.length < 2) return null

      const lineTypeId =
        arrowSegments.sort((left, right) => segmentLength(right) - segmentLength(left))[0]?.lineTypeId ??
        component[0]?.lineTypeId
      const layerId = component[0]?.layerId
      if (!lineTypeId || !layerId) return null

      const bounds = componentBounds(component)
      const candidateTexts = remainingTexts
        .map((text, index) => ({ text, index }))
        .filter(({ text }) => text.layerId === layerId)
        .map(({ text, index }) => ({
          text,
          index,
          distance: distanceToBounds(text.center, bounds),
        }))
        .sort((left, right) => left.distance - right.distance)
      const matchedText = candidateTexts[0]
      if (matchedText && matchedText.distance <= 12) {
        remainingTexts.splice(matchedText.index, 1)
      }

      if (orientation === 'horizontal') {
        const xs = measuredPoints.map((point) => point.x)
        const measuredY = measuredPoints.reduce((sum, point) => sum + point.y, 0) / measuredPoints.length
        return {
          id: uid(),
          start: { x: Math.min(...xs), y: measuredY },
          end: { x: Math.max(...xs), y: measuredY },
          offsetMm: axisCoord - measuredY,
          text: matchedText?.text.text ?? undefined,
          layerId,
          lineTypeId,
        }
      }

      const ys = measuredPoints.map((point) => point.y)
      const measuredX = measuredPoints.reduce((sum, point) => sum + point.x, 0) / measuredPoints.length
      return {
        id: uid(),
        start: { x: measuredX, y: Math.min(...ys) },
        end: { x: measuredX, y: Math.max(...ys) },
        offsetMm: axisCoord - measuredX,
        text: matchedText?.text.text ?? undefined,
        layerId,
        lineTypeId,
      }
    })
    .filter((entry): entry is DimensionLine => entry !== null)

  return built
}
