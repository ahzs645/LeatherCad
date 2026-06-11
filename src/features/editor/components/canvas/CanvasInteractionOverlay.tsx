import type { TextShape } from '../../cad/cad-types'
import type { CanvasRenderEntity, CanvasRenderShapeEntity } from '../../render/canvas-render-model'
import { renderCanvasShape } from './canvas-shape-rendering'

type SelectionBoxEntity = Extract<CanvasRenderEntity, { kind: 'selection-box' }>

type CanvasInteractionOverlayProps = {
  previewShapeEntities: CanvasRenderShapeEntity[]
  selectionBoxEntities: SelectionBoxEntity[]
  previewElement: React.ReactElement | null
  onShapePointerDown: (event: React.PointerEvent<SVGElement>, shapeId: string) => void
  buildTextGlyphPlacements: (shape: TextShape) => Array<{ x: number; y: number; rotationDeg: number; char: string }>
  normalizeTextShape: (shape: TextShape) => TextShape
  textBaselineAngleDeg: (shape: TextShape) => number
}

export function CanvasInteractionOverlay({
  previewShapeEntities,
  selectionBoxEntities,
  previewElement,
  onShapePointerDown,
  buildTextGlyphPlacements,
  normalizeTextShape,
  textBaselineAngleDeg,
}: CanvasInteractionOverlayProps) {
  const hasRenderModelPreviews = selectionBoxEntities.length > 0 || previewShapeEntities.length > 0

  return (
    <>
      {hasRenderModelPreviews && (
        <g className="canvas-interaction-preview-layer">
          {selectionBoxEntities.map((entity) => (
            <rect
              key={entity.id}
              x={entity.bounds.minX}
              y={entity.bounds.minY}
              width={entity.bounds.maxX - entity.bounds.minX}
              height={entity.bounds.maxY - entity.bounds.minY}
              className={entity.paint.className}
            />
          ))}
          {previewShapeEntities.map((entity) => {
            return renderCanvasShape(entity.shape, {
              key: `${entity.id}-preview`,
              className: entity.paint.className,
              color: entity.paint.strokeColor,
              strokeDasharray: entity.paint.strokeDasharray,
              opacity: entity.paint.opacity,
              interactive: entity.paint.interactive,
              onShapePointerDown,
              buildTextGlyphPlacements,
              normalizeTextShape,
              textBaselineAngleDeg,
              strokeWidthMm: entity.paint.strokeWidthMm,
            })
          })}
        </g>
      )}

      {previewElement}
    </>
  )
}
