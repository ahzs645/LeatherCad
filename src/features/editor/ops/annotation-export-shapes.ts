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

type BuildAnnotationExportShapesParams = {
  showAnnotations: boolean
  onlySelected: boolean
  selectedShapeIdSet: Set<string>
  patternPiecesById: Record<string, PatternPiece | undefined>
  annotationLabels: AnnotationLabel[]
  pieceGrainlineSegments: PieceGrainlineSegment[]
  pieceNotchLines: PieceNotchLine[]
  fallbackLayerId: string
  annotationLineTypeId: string
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

  return [...labelShapes, ...grainlineShapes, ...notchShapes]
}
