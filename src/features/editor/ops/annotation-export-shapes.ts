import type { PatternPiece, Shape } from '../cad/cad-types'
import type { AnnotationLabel } from '../editor-types'

type PieceGrainlineSegment = {
  pieceId: string
  start: { x: number; y: number }
  end: { x: number; y: number }
}

type PieceNotchLine = {
  id: string
  pieceId: string
  start: { x: number; y: number }
  end: { x: number; y: number }
  showOnSeam: boolean
}

type PiecePlacementGuide = {
  id: string
  pieceId: string
  kind: 'cross' | 'box' | 'circle' | 'text'
  point: { x: number; y: number }
  rotationDeg: number
  widthMm: number
  heightMm: number
  text?: string
}

type BuildAnnotationExportShapesParams = {
  showAnnotations: boolean
  onlySelected: boolean
  selectedShapeIdSet: Set<string>
  patternPiecesById: Record<string, PatternPiece | undefined>
  annotationLabels: AnnotationLabel[]
  pieceGrainlineSegments: PieceGrainlineSegment[]
  pieceNotchLines: PieceNotchLine[]
  piecePlacementGuides: PiecePlacementGuide[]
  fallbackLayerId: string
  annotationLineTypeId: string
}

function rotatePoint(point: { x: number; y: number }, center: { x: number; y: number }, radians: number) {
  const dx = point.x - center.x
  const dy = point.y - center.y
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

function isPieceSelected(piece: PatternPiece, selectedShapeIdSet: Set<string>) {
  return (
    selectedShapeIdSet.has(piece.boundaryShapeId) ||
    piece.internalShapeIds.some((shapeId) => selectedShapeIdSet.has(shapeId))
  )
}

export function buildAnnotationExportShapes(params: BuildAnnotationExportShapesParams): Shape[] {
  const {
    showAnnotations,
    onlySelected,
    selectedShapeIdSet,
    patternPiecesById,
    annotationLabels,
    pieceGrainlineSegments,
    pieceNotchLines,
    piecePlacementGuides,
    fallbackLayerId,
    annotationLineTypeId,
  } = params

  if (!showAnnotations) {
    return []
  }

  const selectedPieceIdSet = onlySelected
    ? new Set(
        Object.values(patternPiecesById)
          .filter((piece): piece is PatternPiece => piece !== undefined && isPieceSelected(piece, selectedShapeIdSet))
          .map((piece) => piece.id),
      )
    : null

  const allowPiece = (pieceId: string | undefined) => !selectedPieceIdSet || (pieceId ? selectedPieceIdSet.has(pieceId) : false)
  const resolveLayerId = (pieceId: string | undefined) => patternPiecesById[pieceId ?? '']?.layerId ?? fallbackLayerId

  const labelShapes: Shape[] = annotationLabels
    .filter((label) => allowPiece(label.pieceId))
    .map((label) => {
      const fontSizeMm = Math.max(4, label.fontSizeMm ?? 6)
      const rotationDeg = label.rotationDeg ?? 0
      const radians = (rotationDeg * Math.PI) / 180
      const approxHalfWidth = Math.max(fontSizeMm, label.text.length * fontSizeMm * 0.3) / 2
      const dx = Math.cos(radians) * approxHalfWidth
      const dy = Math.sin(radians) * approxHalfWidth
      return {
        id: `annotation-export-${label.id}`,
        type: 'text',
        layerId: resolveLayerId(label.pieceId),
        lineTypeId: annotationLineTypeId,
        start: { x: label.point.x - dx, y: label.point.y - dy },
        end: { x: label.point.x + dx, y: label.point.y + dy },
        text: label.text,
        fontFamily: 'Arial',
        fontSizeMm,
        transform: 'none',
        radiusMm: 0,
        sweepDeg: 0,
      } satisfies Shape
    })

  const grainlineShapes: Shape[] = pieceGrainlineSegments
    .filter((segment) => allowPiece(segment.pieceId))
    .map((segment) => ({
      id: `annotation-export-grainline-${segment.pieceId}`,
      type: 'line',
      layerId: resolveLayerId(segment.pieceId),
      lineTypeId: annotationLineTypeId,
      start: segment.start,
      end: segment.end,
    }))

  const notchShapes: Shape[] = pieceNotchLines
    .filter((notch) => allowPiece(notch.pieceId))
    .map((notch) => ({
      id: `annotation-export-notch-${notch.id}`,
      type: 'line',
      layerId: resolveLayerId(notch.pieceId),
      lineTypeId: annotationLineTypeId,
      start: notch.start,
      end: notch.end,
    }))

  const placementShapes: Shape[] = piecePlacementGuides
    .filter((guide) => allowPiece(guide.pieceId))
    .flatMap<Shape>((guide) => {
      const layerId = resolveLayerId(guide.pieceId)
      const radians = (guide.rotationDeg * Math.PI) / 180
      const halfWidth = guide.widthMm / 2
      const halfHeight = guide.heightMm / 2

      if (guide.kind === 'text' && guide.text) {
        const dx = Math.cos(radians) * halfWidth
        const dy = Math.sin(radians) * halfWidth
        return [{
          id: `annotation-export-placement-${guide.id}`,
          type: 'text',
          layerId,
          lineTypeId: annotationLineTypeId,
          start: { x: guide.point.x - dx, y: guide.point.y - dy },
          end: { x: guide.point.x + dx, y: guide.point.y + dy },
          text: guide.text,
          fontFamily: 'Arial',
          fontSizeMm: Math.max(4, guide.heightMm),
          transform: 'none',
          radiusMm: 0,
          sweepDeg: 0,
        } satisfies Shape]
      }

      if (guide.kind === 'circle') {
        const segments = 8
        return Array.from({ length: segments }, (_, index) => {
          const startAngle = (index / segments) * Math.PI * 2
          const endAngle = ((index + 1) / segments) * Math.PI * 2
          return {
            id: `annotation-export-placement-${guide.id}-${index}`,
            type: 'line',
            layerId,
            lineTypeId: annotationLineTypeId,
            start: {
              x: guide.point.x + Math.cos(startAngle) * halfWidth,
              y: guide.point.y + Math.sin(startAngle) * halfWidth,
            },
            end: {
              x: guide.point.x + Math.cos(endAngle) * halfWidth,
              y: guide.point.y + Math.sin(endAngle) * halfWidth,
            },
          } satisfies Shape
        })
      }

      const corners = [
        { x: guide.point.x - halfWidth, y: guide.point.y - halfHeight },
        { x: guide.point.x + halfWidth, y: guide.point.y - halfHeight },
        { x: guide.point.x + halfWidth, y: guide.point.y + halfHeight },
        { x: guide.point.x - halfWidth, y: guide.point.y + halfHeight },
      ].map((point) => rotatePoint(point, guide.point, radians))

      if (guide.kind === 'box') {
        return corners.map((corner, index) => ({
          id: `annotation-export-placement-${guide.id}-${index}`,
          type: 'line',
          layerId,
          lineTypeId: annotationLineTypeId,
          start: corner,
          end: corners[(index + 1) % corners.length],
        } satisfies Shape))
      }

      const crossSegments = [
        [
          rotatePoint({ x: guide.point.x - halfWidth, y: guide.point.y }, guide.point, radians),
          rotatePoint({ x: guide.point.x + halfWidth, y: guide.point.y }, guide.point, radians),
        ],
        [
          rotatePoint({ x: guide.point.x, y: guide.point.y - halfHeight }, guide.point, radians),
          rotatePoint({ x: guide.point.x, y: guide.point.y + halfHeight }, guide.point, radians),
        ],
      ] as const

      return crossSegments.map(([start, end], index) => ({
        id: `annotation-export-placement-${guide.id}-${index}`,
        type: 'line',
        layerId,
        lineTypeId: annotationLineTypeId,
        start,
        end,
      } satisfies Shape))
    })

  return [...labelShapes, ...grainlineShapes, ...notchShapes, ...placementShapes]
}
