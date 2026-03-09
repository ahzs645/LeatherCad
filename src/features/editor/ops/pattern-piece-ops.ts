import { clamp, round, sampleShapePoints, uid } from '../cad/cad-geometry'
import type {
  LegacySeamAllowance,
  LineType,
  PatternPiece,
  PieceGrainline,
  PieceLabel,
  PiecePlacementLabel,
  PieceNotch,
  PieceSeamAllowance,
  Point,
  Shape,
} from '../cad/cad-types'
import { DEFAULT_SEAM_ALLOWANCE_MM } from '../editor-constants'
import { type OutlineChain, detectOutlines } from './outline-detection'
import { offsetPolygon } from './clipper-ops'

export type PieceDerivedLabel = {
  id: string
  text: string
  point: Point
  rotationDeg: number
  fontSizeMm: number
  kind: PieceLabel['kind']
}

export type PieceDerivedGrainline = {
  pieceId: string
  start: Point
  end: Point
}

export type PieceDerivedNotchLine = {
  id: string
  pieceId: string
  start: Point
  end: Point
  showOnSeam: boolean
}

export type PieceDerivedPlacementGuide = {
  id: string
  pieceId: string
  kind: PiecePlacementLabel['kind']
  point: Point
  rotationDeg: number
  widthMm: number
  heightMm: number
  text?: string
}

export const AVAILABLE_PIECE_LABEL_TOKENS = [
  '{{name}}',
  '{{code}}',
  '{{quantity}}',
  '{{annotation}}',
  '{{material}}',
  '{{side}}',
  '{{notes}}',
  '{{fold}}',
  '{{mirror}}',
] as const

export function createDefaultPatternPiece(boundaryShapeId: string, layerId: string, name: string): PatternPiece {
  return {
    id: uid(),
    name,
    boundaryShapeId,
    internalShapeIds: [],
    layerId,
    quantity: 1,
    code: undefined,
    onFold: false,
    material: undefined,
    materialSide: 'either',
    notes: undefined,
    mirrorPair: false,
    orientation: 'any',
    allowFlip: true,
    includeInLayout: true,
    locked: false,
  }
}

export function createDefaultPieceGrainline(pieceId: string): PieceGrainline {
  return {
    pieceId,
    visible: true,
    mode: 'auto',
    rotationDeg: 90,
    anchor: 'center',
  }
}

export function createDefaultPieceLabels(piece: PatternPiece): PieceLabel[] {
  return [
    {
      id: uid(),
      pieceId: piece.id,
      visible: true,
      kind: 'piece',
      textTemplate: '{{name}} x{{quantity}}',
      rotationDeg: 0,
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      fontSizeMm: 8,
    },
    {
      id: uid(),
      pieceId: piece.id,
      visible: false,
      kind: 'pattern',
      textTemplate: '{{name}}',
      rotationDeg: 0,
      anchor: 'center',
      offsetX: 0,
      offsetY: 10,
      fontSizeMm: 6,
    },
  ]
}

export function createDefaultPiecePlacementLabel(pieceId: string): PiecePlacementLabel {
  return {
    id: uid(),
    pieceId,
    name: 'Placement Label',
    visible: true,
    kind: 'cross',
    anchor: 'center',
    edgeIndex: 0,
    t: 0.5,
    offsetX: 0,
    offsetY: 0,
    widthMm: 6,
    heightMm: 6,
    rotationDeg: 0,
    text: undefined,
    showOnSeam: false,
  }
}

export function createDefaultPieceSeamAllowance(pieceId: string, offsetMm = DEFAULT_SEAM_ALLOWANCE_MM): PieceSeamAllowance {
  return {
    id: uid(),
    pieceId,
    enabled: true,
    defaultOffsetMm: Math.max(0.1, Math.abs(offsetMm)),
    edgeOverrides: [],
  }
}

export function resolvePatternPieceChains(shapes: Shape[], lineTypes: LineType[]) {
  const chains = detectOutlines(shapes, lineTypes)
  const byShapeId = new Map<string, OutlineChain>()
  for (const chain of chains) {
    for (const shapeId of chain.shapeIds) {
      byShapeId.set(shapeId, chain)
    }
  }
  return {
    chains,
    byShapeId,
  }
}

export function getPatternPieceChain(
  piece: PatternPiece,
  chainsByShapeId: Map<string, OutlineChain>,
): OutlineChain | null {
  const chain = chainsByShapeId.get(piece.boundaryShapeId) ?? null
  return chain?.isClosed ? chain : null
}

export function pointAlongPolyline(polyline: Point[], edgeIndex: number, t: number) {
  if (polyline.length < 2) {
    return null
  }
  const start = polyline[Math.max(0, Math.min(polyline.length - 2, edgeIndex))]
  const end = polyline[Math.max(1, Math.min(polyline.length - 1, edgeIndex + 1))]
  const safeT = clamp(t, 0, 1)
  return {
    point: {
      x: start.x + (end.x - start.x) * safeT,
      y: start.y + (end.y - start.y) * safeT,
    },
    tangent: {
      x: end.x - start.x,
      y: end.y - start.y,
    },
  }
}

function polygonBounds(points: Point[]) {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

function pointsEqual(a: Point, b: Point, epsilon = 1e-6) {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon
}

function normalizeClosedPolygon(points: Point[]) {
  if (points.length >= 2 && pointsEqual(points[0], points[points.length - 1])) {
    return points.slice(0, -1)
  }
  return [...points]
}

function polygonSignedArea(points: Point[]) {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return area / 2
}

function lineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const denominator = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x)
  if (Math.abs(denominator) < 1e-6) {
    return null
  }

  const determinantA = a1.x * a2.y - a1.y * a2.x
  const determinantB = b1.x * b2.y - b1.y * b2.x

  return {
    x: (determinantA * (b1.x - b2.x) - (a1.x - a2.x) * determinantB) / denominator,
    y: (determinantA * (b1.y - b2.y) - (a1.y - a2.y) * determinantB) / denominator,
  }
}

function buildVariableOffsetPolygon(points: Point[], seamAllowance: PieceSeamAllowance) {
  const polygon = normalizeClosedPolygon(points)
  if (polygon.length < 3) {
    return null
  }

  const signedArea = polygonSignedArea(polygon)
  const outwardSign = signedArea >= 0 ? 1 : -1
  const overrideByEdgeIndex = new Map(seamAllowance.edgeOverrides.map((entry) => [entry.edgeIndex, entry.offsetMm]))
  const result: Point[] = []

  for (let index = 0; index < polygon.length; index += 1) {
    const previous = polygon[(index - 1 + polygon.length) % polygon.length]
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]

    const previousOffset = overrideByEdgeIndex.get((index - 1 + polygon.length) % polygon.length) ?? seamAllowance.defaultOffsetMm
    const currentOffset = overrideByEdgeIndex.get(index) ?? seamAllowance.defaultOffsetMm

    const previousDx = current.x - previous.x
    const previousDy = current.y - previous.y
    const currentDx = next.x - current.x
    const currentDy = next.y - current.y
    const previousLength = Math.hypot(previousDx, previousDy)
    const currentLength = Math.hypot(currentDx, currentDy)

    if (previousLength < 1e-6 || currentLength < 1e-6) {
      continue
    }

    const previousNormal = {
      x: (previousDy / previousLength) * outwardSign,
      y: (-previousDx / previousLength) * outwardSign,
    }
    const currentNormal = {
      x: (currentDy / currentLength) * outwardSign,
      y: (-currentDx / currentLength) * outwardSign,
    }

    const previousLineStart = {
      x: previous.x + previousNormal.x * previousOffset,
      y: previous.y + previousNormal.y * previousOffset,
    }
    const previousLineEnd = {
      x: current.x + previousNormal.x * previousOffset,
      y: current.y + previousNormal.y * previousOffset,
    }
    const currentLineStart = {
      x: current.x + currentNormal.x * currentOffset,
      y: current.y + currentNormal.y * currentOffset,
    }
    const currentLineEnd = {
      x: next.x + currentNormal.x * currentOffset,
      y: next.y + currentNormal.y * currentOffset,
    }

    const intersection = lineIntersection(previousLineStart, previousLineEnd, currentLineStart, currentLineEnd)
    if (intersection) {
      result.push(intersection)
      continue
    }

    result.push({
      x: (previousLineEnd.x + currentLineStart.x) / 2,
      y: (previousLineEnd.y + currentLineStart.y) / 2,
    })
  }

  return result.length >= 3 ? result : null
}

export function buildPatternPieceSeamPolygon(chain: OutlineChain, seamAllowance: PieceSeamAllowance): Point[] | null {
  if (!seamAllowance.enabled || chain.polygon.length < 3) {
    return null
  }
  if (seamAllowance.edgeOverrides.length > 0) {
    return buildVariableOffsetPolygon(chain.polygon, seamAllowance)
  }
  const [offset] = offsetPolygon(chain.polygon, seamAllowance.defaultOffsetMm, 'round')
  return offset && offset.length >= 3 ? offset : null
}

export function polygonCenter(points: Point[]): Point | null {
  const bounds = polygonBounds(points)
  if (!bounds) {
    return null
  }
  return {
    x: bounds.minX + bounds.width / 2,
    y: bounds.minY + bounds.height / 2,
  }
}

export function buildPatternPieceSeamPath(chain: OutlineChain, seamAllowance: PieceSeamAllowance): string | null {
  const offset = buildPatternPieceSeamPolygon(chain, seamAllowance)
  if (!offset || offset.length < 2) {
    return null
  }
  return offset
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${round(point.x)} ${round(point.y)}`)
    .join(' ') + ' Z'
}

export function buildPieceDerivedGrainline(
  piece: PatternPiece,
  grainline: PieceGrainline | undefined,
  chain: OutlineChain,
): PieceDerivedGrainline | null {
  if (!grainline?.visible) {
    return null
  }
  const bounds = polygonBounds(chain.polygon)
  const center = polygonCenter(chain.polygon)
  if (!bounds || !center) {
    return null
  }
  const lengthMm =
    typeof grainline.lengthMm === 'number' && Number.isFinite(grainline.lengthMm) && grainline.lengthMm > 0
      ? grainline.lengthMm
      : Math.max(bounds.height, bounds.width * 0.6)
  const rotationDeg = grainline.mode === 'auto'
    ? bounds.height >= bounds.width ? 90 : 0
    : grainline.rotationDeg
  const radians = (rotationDeg * Math.PI) / 180
  const dx = Math.cos(radians) * (lengthMm / 2)
  const dy = Math.sin(radians) * (lengthMm / 2)
  return {
    pieceId: piece.id,
    start: { x: center.x - dx, y: center.y - dy },
    end: { x: center.x + dx, y: center.y + dy },
  }
}

function applyTemplate(template: string, piece: PatternPiece) {
  const tokenMap: Record<(typeof AVAILABLE_PIECE_LABEL_TOKENS)[number], string> = {
    '{{name}}': piece.name,
    '{{code}}': piece.code ?? '',
    '{{quantity}}': String(piece.quantity),
    '{{annotation}}': piece.annotation ?? '',
    '{{material}}': piece.material ?? '',
    '{{side}}': piece.materialSide ?? 'either',
    '{{notes}}': piece.notes ?? '',
    '{{fold}}': piece.onFold ? 'On fold' : '',
    '{{mirror}}': piece.mirrorPair ? 'Mirror pair' : '',
  }

  let text = template
  for (const token of AVAILABLE_PIECE_LABEL_TOKENS) {
    text = text.replaceAll(token, tokenMap[token])
  }

  return text
    .replaceAll(/\s*\n\s*/g, ' ')
    .replaceAll(/\s{2,}/g, ' ')
    .trim()
}

export function buildPieceDerivedLabels(
  piece: PatternPiece,
  labels: PieceLabel[],
  chain: OutlineChain,
): PieceDerivedLabel[] {
  const center = polygonCenter(chain.polygon)
  if (!center) {
    return []
  }
  return labels
    .filter((label) => label.pieceId === piece.id && label.visible)
    .map((label) => ({
      id: label.id,
      text: applyTemplate(label.textTemplate, piece).trim(),
      point: {
        x: center.x + label.offsetX,
        y: center.y + label.offsetY,
      },
      rotationDeg: label.rotationDeg,
      fontSizeMm: label.fontSizeMm,
      kind: label.kind,
    }))
    .filter((label) => label.text.length > 0)
}

export function buildPieceDerivedNotches(
  piece: PatternPiece,
  pieceNotches: PieceNotch[],
  chain: OutlineChain,
  seamAllowance?: PieceSeamAllowance,
): PieceDerivedNotchLine[] {
  const seamPolygon = seamAllowance ? buildPatternPieceSeamPolygon(chain, seamAllowance) : null

  return pieceNotches
    .filter((notch) => notch.pieceId === piece.id)
    .flatMap((notch) => {
      const referencePolyline = notch.showOnSeam && seamPolygon ? seamPolygon : chain.polygon
      const sampled = pointAlongPolyline(referencePolyline, notch.edgeIndex, notch.t)
      if (!sampled) {
        return []
      }
      const tangentLength = Math.hypot(sampled.tangent.x, sampled.tangent.y)
      if (tangentLength < 1e-6) {
        return []
      }
      const tangentX = sampled.tangent.x / tangentLength
      const tangentY = sampled.tangent.y / tangentLength
      const normalAngle = notch.angleMode === 'fixed'
        ? ((notch.angleDeg ?? 90) * Math.PI) / 180
        : Math.atan2(tangentY, tangentX) + Math.PI / 2
      const normalX = Math.cos(normalAngle)
      const normalY = Math.sin(normalAngle)
      const halfWidth = Math.max(0, notch.widthMm) / 2
      const length = Math.max(0.5, notch.lengthMm)

      if (notch.style === 'double') {
        return [-halfWidth, halfWidth].map((offset, index) => ({
          id: `${notch.id}-${index}`,
          pieceId: piece.id,
          start: {
            x: sampled.point.x + tangentX * offset,
            y: sampled.point.y + tangentY * offset,
          },
          end: {
            x: sampled.point.x + tangentX * offset + normalX * length,
            y: sampled.point.y + tangentY * offset + normalY * length,
          },
          showOnSeam: notch.showOnSeam,
        }))
      }

      if (notch.style === 'v') {
        return [
          {
            id: `${notch.id}-a`,
            pieceId: piece.id,
            start: sampled.point,
            end: {
              x: sampled.point.x + normalX * length + tangentX * halfWidth,
              y: sampled.point.y + normalY * length + tangentY * halfWidth,
            },
            showOnSeam: notch.showOnSeam,
          },
          {
            id: `${notch.id}-b`,
            pieceId: piece.id,
            start: sampled.point,
            end: {
              x: sampled.point.x + normalX * length - tangentX * halfWidth,
              y: sampled.point.y + normalY * length - tangentY * halfWidth,
            },
            showOnSeam: notch.showOnSeam,
          },
        ]
      }

      return [
        {
          id: notch.id,
          pieceId: piece.id,
          start: sampled.point,
          end: {
            x: sampled.point.x + normalX * length,
            y: sampled.point.y + normalY * length,
          },
          showOnSeam: notch.showOnSeam,
        },
      ]
    })
}

export function buildPieceDerivedPlacementGuides(
  piece: PatternPiece,
  placementLabels: PiecePlacementLabel[],
  chain: OutlineChain,
  seamAllowance?: PieceSeamAllowance,
): PieceDerivedPlacementGuide[] {
  const center = polygonCenter(chain.polygon)
  const seamPolygon = seamAllowance ? buildPatternPieceSeamPolygon(chain, seamAllowance) : null

  return placementLabels
    .filter((label) => label.pieceId === piece.id && label.visible)
    .flatMap((label) => {
      if (label.anchor === 'center') {
        if (!center) {
          return []
        }
        return [{
          id: label.id,
          pieceId: piece.id,
          kind: label.kind,
          point: { x: center.x + label.offsetX, y: center.y + label.offsetY },
          rotationDeg: label.rotationDeg,
          widthMm: label.widthMm,
          heightMm: label.heightMm,
          text: label.text,
        }]
      }

      const referencePolyline = label.showOnSeam && seamPolygon ? seamPolygon : chain.polygon
      const sampled = pointAlongPolyline(referencePolyline, label.edgeIndex, label.t)
      if (!sampled) {
        return []
      }
      const tangentLength = Math.hypot(sampled.tangent.x, sampled.tangent.y)
      if (tangentLength < 1e-6) {
        return []
      }
      const tangentX = sampled.tangent.x / tangentLength
      const tangentY = sampled.tangent.y / tangentLength
      const normalX = -tangentY
      const normalY = tangentX

      return [{
        id: label.id,
        pieceId: piece.id,
        kind: label.kind,
        point: {
          x: sampled.point.x + tangentX * label.offsetX + normalX * label.offsetY,
          y: sampled.point.y + tangentY * label.offsetX + normalY * label.offsetY,
        },
        rotationDeg: Math.atan2(tangentY, tangentX) * (180 / Math.PI) + label.rotationDeg,
        widthMm: label.widthMm,
        heightMm: label.heightMm,
        text: label.text,
      }]
    })
}

export function migrateLegacySeamAllowances(
  legacyEntries: LegacySeamAllowance[],
  patternPieces: PatternPiece[],
): PieceSeamAllowance[] {
  const byBoundaryShapeId = new Map(patternPieces.map((piece) => [piece.boundaryShapeId, piece]))
  const migrated: PieceSeamAllowance[] = []
  for (const entry of legacyEntries) {
    const piece = byBoundaryShapeId.get(entry.shapeId)
    if (!piece) {
      continue
    }
    migrated.push(createDefaultPieceSeamAllowance(piece.id, entry.offsetMm))
  }
  return migrated
}

export function clonePatternPieceSelection(
  patternPieces: PatternPiece[],
  pieceGrainlines: PieceGrainline[],
  pieceLabels: PieceLabel[],
  piecePlacementLabels: PiecePlacementLabel[],
  seamAllowances: PieceSeamAllowance[],
  pieceNotches: PieceNotch[],
  shapeIdMap: Map<string, string>,
): {
  patternPieces: PatternPiece[]
  pieceGrainlines: PieceGrainline[]
  pieceLabels: PieceLabel[]
  piecePlacementLabels: PiecePlacementLabel[]
  seamAllowances: PieceSeamAllowance[]
  pieceNotches: PieceNotch[]
} {
  const sourcePieces = patternPieces.filter((piece) => shapeIdMap.has(piece.boundaryShapeId))
  const createdPieces = sourcePieces
    .map((piece) => {
      const nextId = uid()
      return {
        ...piece,
        id: nextId,
        boundaryShapeId: shapeIdMap.get(piece.boundaryShapeId) ?? piece.boundaryShapeId,
        internalShapeIds: piece.internalShapeIds.map((shapeId) => shapeIdMap.get(shapeId) ?? shapeId),
      }
    })

  const pieceIdMap = new Map(sourcePieces.map((piece, index) => [piece.id, createdPieces[index].id]))

  return {
    patternPieces: createdPieces,
    pieceGrainlines: pieceGrainlines
      .filter((grainline) => pieceIdMap.has(grainline.pieceId))
      .map((grainline) => ({
        ...grainline,
        pieceId: pieceIdMap.get(grainline.pieceId) ?? grainline.pieceId,
      })),
    pieceLabels: pieceLabels
      .filter((label) => pieceIdMap.has(label.pieceId))
      .map((label) => ({
        ...label,
        id: uid(),
        pieceId: pieceIdMap.get(label.pieceId) ?? label.pieceId,
      })),
    piecePlacementLabels: piecePlacementLabels
      .filter((label) => pieceIdMap.has(label.pieceId))
      .map((label) => ({
        ...label,
        id: uid(),
        pieceId: pieceIdMap.get(label.pieceId) ?? label.pieceId,
      })),
    seamAllowances: seamAllowances
      .filter((entry) => pieceIdMap.has(entry.pieceId))
      .map((entry) => ({
        ...entry,
        id: uid(),
        pieceId: pieceIdMap.get(entry.pieceId) ?? entry.pieceId,
        edgeOverrides: entry.edgeOverrides.map((override) => ({ ...override })),
      })),
    pieceNotches: pieceNotches
      .filter((notch) => pieceIdMap.has(notch.pieceId))
      .map((notch) => ({
        ...notch,
        id: uid(),
        pieceId: pieceIdMap.get(notch.pieceId) ?? notch.pieceId,
      })),
  }
}

export function findNearestPatternPieceEdge(
  point: Point,
  pieces: PatternPiece[],
  chainsByShapeId: Map<string, OutlineChain>,
): { piece: PatternPiece; edgeIndex: number; t: number } | null {
  let best:
    | {
        piece: PatternPiece
        edgeIndex: number
        t: number
        distance: number
      }
    | null = null

  for (const piece of pieces) {
    const chain = getPatternPieceChain(piece, chainsByShapeId)
    if (!chain || chain.polygon.length < 2) {
      continue
    }

    for (let index = 0; index < chain.polygon.length - 1; index += 1) {
      const start = chain.polygon[index]
      const end = chain.polygon[index + 1]
      const dx = end.x - start.x
      const dy = end.y - start.y
      const lengthSq = dx * dx + dy * dy
      if (lengthSq < 1e-6) {
        continue
      }
      const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1)
      const projected = {
        x: start.x + dx * t,
        y: start.y + dy * t,
      }
      const candidateDistance = Math.hypot(projected.x - point.x, projected.y - point.y)
      if (!best || candidateDistance < best.distance) {
        best = {
          piece,
          edgeIndex: index,
          t,
          distance: candidateDistance,
        }
      }
    }
  }

  if (!best || best.distance > 12) {
    return null
  }

  return {
    piece: best.piece,
    edgeIndex: best.edgeIndex,
    t: best.t,
  }
}

export function buildRepresentativeBoundaryPoints(shape: Shape): Point[] {
  return sampleShapePoints(shape, shape.type === 'line' ? 1 : 48)
}
