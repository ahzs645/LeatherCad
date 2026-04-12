import { lineTypeStrokeDasharray } from '../../cad/line-types'
import type { LineType, Shape, TextShape } from '../../cad/cad-types'
import { renderCanvasShape } from './canvas-shape-rendering'

type CanvasInteractionOverlayProps = {
  interactionPreview: import('../../hooks/useCanvasInteractions').CanvasInteractionPreview | null
  previewShapes: Shape[]
  previewElement: React.ReactElement | null
  lineTypesById: Record<string, LineType | undefined>
  resolveShapeStrokeColor: (shape: Shape) => string
  shapeStrokeOpacity: number
  onShapePointerDown: (event: React.PointerEvent<SVGElement>, shapeId: string) => void
  buildTextGlyphPlacements: (shape: TextShape) => Array<{ x: number; y: number; rotationDeg: number; char: string }>
  normalizeTextShape: (shape: TextShape) => TextShape
  textBaselineAngleDeg: (shape: TextShape) => number
}

export function CanvasInteractionOverlay({
  interactionPreview,
  previewShapes,
  previewElement,
  lineTypesById,
  resolveShapeStrokeColor,
  shapeStrokeOpacity,
  onShapePointerDown,
  buildTextGlyphPlacements,
  normalizeTextShape,
  textBaselineAngleDeg,
}: CanvasInteractionOverlayProps) {
  return (
    <>
      {interactionPreview && (
        <g className="canvas-interaction-preview-layer">
          {previewShapes.map((shape) => {
            const lineType = lineTypesById[shape.lineTypeId]
            const layerStroke = resolveShapeStrokeColor(shape)
            const strokeDasharray = lineTypeStrokeDasharray(lineType?.style ?? 'solid')
            const className = shape.type === 'text'
              ? 'annotation-label text-shape text-shape-selected shape-live-preview'
              : 'shape-line shape-selected shape-live-preview'

            return renderCanvasShape(shape, {
              key: `${shape.id}-preview`,
              className,
              color: layerStroke,
              strokeDasharray,
              opacity: Math.max(0.95, shapeStrokeOpacity),
              interactive: false,
              onShapePointerDown,
              buildTextGlyphPlacements,
              normalizeTextShape,
              textBaselineAngleDeg,
            })
          })}
        </g>
      )}

      {previewElement}
    </>
  )
}
