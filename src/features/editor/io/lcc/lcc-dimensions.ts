import { uid } from '../../cad/cad-geometry'
import type { DimensionLine, Point } from '../../cad/cad-types'
import type { RawDimensionSegment, RawDimensionText } from './lcc-types'

export function parseLccPathCenter(path: string | undefined) {
  if (!path) {
    return null
  }

  const values = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  if (values.length < 2) {
    return null
  }

  const xs: number[] = []
  const ys: number[] = []
  for (let index = 0; index < values.length - 1; index += 2) {
    const x = values[index]
    const y = values[index + 1]
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x)
      ys.push(y)
    }
  }

  if (xs.length === 0 || ys.length === 0) {
    return null
  }

  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  }
}

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

function normalizeSourceGroupId(value: string | undefined) {
  if (!value || value === '0' || value === '-1') {
    return null
  }
  return value
}

function inferredTextGroupId(text: RawDimensionText) {
  const sourceId = Number(text.sourceId)
  if (!Number.isFinite(sourceId)) {
    return null
  }
  return String(sourceId + 1)
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

function buildDimensionLine(component: RawDimensionSegment[], matchedText?: RawDimensionText): DimensionLine | null {
  const analysis = analyzeDimensionComponent(component)
  if (!analysis) return null
  const { orientation, axisCoord } = analysis
  const arrowSegments = component.filter((segment) => segment.hasArrowStart || segment.hasArrowEnd)
  const labelFields = matchedText
    ? {
        text: matchedText.text,
        ...(matchedText.fontSizeMm ? { fontSizeMm: matchedText.fontSizeMm } : {}),
        labelPoint: matchedText.anchor,
        ...(typeof matchedText.rotationDeg === 'number' ? { labelRotationDeg: matchedText.rotationDeg } : {}),
        ...(matchedText.placement ? { labelPlacement: matchedText.placement } : {}),
      }
    : {}

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

  if (orientation === 'horizontal') {
    const xs = measuredPoints.map((point) => point.x)
    const measuredY = measuredPoints.reduce((sum, point) => sum + point.y, 0) / measuredPoints.length
    return {
      id: uid(),
      start: { x: Math.min(...xs), y: measuredY },
      end: { x: Math.max(...xs), y: measuredY },
      offsetMm: axisCoord - measuredY,
      ...labelFields,
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
    offsetMm: measuredX - axisCoord,
    ...labelFields,
    layerId,
    lineTypeId,
  }
}

function findTextForComponent(
  component: RawDimensionSegment[],
  texts: RawDimensionText[],
  usedTextIndexes: Set<number>,
  sourceGroupId?: string,
) {
  const layerId = component[0]?.layerId
  if (!layerId) {
    return undefined
  }

  const findBy = (predicate: (text: RawDimensionText) => boolean) => {
    const index = texts.findIndex((text, textIndex) => !usedTextIndexes.has(textIndex) && text.layerId === layerId && predicate(text))
    if (index < 0) {
      return undefined
    }
    usedTextIndexes.add(index)
    return texts[index]
  }

  if (sourceGroupId) {
    const exact = findBy((text) => normalizeSourceGroupId(text.sourceGroupId) === sourceGroupId)
    if (exact) {
      return exact
    }

    const inferred = findBy((text) => inferredTextGroupId(text) === sourceGroupId)
    if (inferred) {
      return inferred
    }
  }

  const bounds = componentBounds(component)
  const candidateTexts = texts
    .map((text, index) => ({ text, index }))
    .filter(({ text, index }) => !usedTextIndexes.has(index) && text.layerId === layerId)
    .map(({ text, index }) => ({
      text,
      index,
      distance: distanceToBounds(text.center, bounds),
    }))
    .sort((left, right) => left.distance - right.distance)
  const matchedText = candidateTexts[0]
  if (!matchedText || matchedText.distance > 12) {
    return undefined
  }

  usedTextIndexes.add(matchedText.index)
  return matchedText.text
}

function rebuildGeometryClusteredDimensions(
  segments: RawDimensionSegment[],
  texts: RawDimensionText[],
  usedTextIndexes = new Set<number>(),
): DimensionLine[] {
  const components = mergeSplitDimensionComponents(clusterDimensionSegments(segments), texts)

  return components
    .map((component) => buildDimensionLine(component, findTextForComponent(component, texts, usedTextIndexes)))
    .filter((entry): entry is DimensionLine => entry !== null)
}

function rebuildGroupedDimensions(segments: RawDimensionSegment[], texts: RawDimensionText[]) {
  const groups = new Map<string, RawDimensionSegment[]>()
  const ungroupedSegments: RawDimensionSegment[] = []

  for (const segment of segments) {
    const sourceGroupId = normalizeSourceGroupId(segment.sourceGroupId)
    if (!sourceGroupId) {
      ungroupedSegments.push(segment)
      continue
    }
    groups.set(sourceGroupId, [...(groups.get(sourceGroupId) ?? []), segment])
  }

  if (groups.size === 0) {
    return null
  }

  const usedTextIndexes = new Set<number>()
  const rebuiltGroups = Array.from(groups.entries())
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([sourceGroupId, component]) =>
      buildDimensionLine(component, findTextForComponent(component, texts, usedTextIndexes, sourceGroupId)),
    )
    .filter((entry): entry is DimensionLine => entry !== null)

  if (ungroupedSegments.length === 0) {
    return rebuiltGroups
  }

  return [
    ...rebuiltGroups,
    ...rebuildGeometryClusteredDimensions(ungroupedSegments, texts, usedTextIndexes),
  ]
}

export function rebuildImportedDimensions(segments: RawDimensionSegment[], texts: RawDimensionText[]): DimensionLine[] {
  if (segments.length === 0 && texts.length === 0) {
    return []
  }

  return rebuildGroupedDimensions(segments, texts) ?? rebuildGeometryClusteredDimensions(segments, texts)
}
