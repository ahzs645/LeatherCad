import type { TextShape } from '../../cad/cad-types'
import type { CanvasRenderEntity, CanvasRenderShapeEntity } from '../../render/canvas-render-model'
import { renderCanvasShape } from './canvas-shape-rendering'

type SelectionBoxEntity = Extract<CanvasRenderEntity, { kind: 'selection-box' }>
type SnapAnchorEntity = Extract<CanvasRenderEntity, { kind: 'snap-anchor' }>
type AngleGuideEntity = Extract<CanvasRenderEntity, { kind: 'angle-guide' }>

type CanvasInteractionOverlayProps = {
  previewShapeEntities: CanvasRenderShapeEntity[]
  selectionBoxEntities: SelectionBoxEntity[]
  snapAnchorEntities: SnapAnchorEntity[]
  angleGuideEntities: AngleGuideEntity[]
  previewElement: React.ReactElement | null
  onShapePointerDown: (event: React.PointerEvent<SVGElement>, shapeId: string) => void
  buildTextGlyphPlacements: (shape: TextShape) => Array<{ x: number; y: number; rotationDeg: number; char: string }>
  normalizeTextShape: (shape: TextShape) => TextShape
  textBaselineAngleDeg: (shape: TextShape) => number
}

export function CanvasInteractionOverlay({
  previewShapeEntities,
  selectionBoxEntities,
  snapAnchorEntities,
  angleGuideEntities,
  previewElement,
  onShapePointerDown,
  buildTextGlyphPlacements,
  normalizeTextShape,
  textBaselineAngleDeg,
}: CanvasInteractionOverlayProps) {
  const hasRenderModelPreviews = selectionBoxEntities.length > 0 || previewShapeEntities.length > 0
  const hasSnapOverlay = snapAnchorEntities.length > 0 || angleGuideEntities.length > 0

  return (
    <>
      {hasSnapOverlay && (
        <g className="snap-indicator" pointerEvents="none">
          {angleGuideEntities.map((entity) => (
            <line
              key={entity.id}
              x1={entity.payload.start.x}
              y1={entity.payload.start.y}
              x2={entity.payload.end.x}
              y2={entity.payload.end.y}
              className={entity.paint.className}
            />
          ))}
          {snapAnchorEntities.map((entity) => {
            const { point, reason, active } = entity.payload
            if (active) {
              return (
                <g key={entity.id}>
                  <circle cx={point.x} cy={point.y} r={4} fill="none" stroke="#10b981" strokeWidth={1.5} />
                  <circle cx={point.x} cy={point.y} r={1.2} fill="#10b981" />
                  <title>{`Snapped to ${reason}`}</title>
                </g>
              )
            }

            return (
              <g key={entity.id} className={entity.paint.className}>
                <circle cx={point.x} cy={point.y} r={5.5} />
                <path d={`M ${point.x - 3.5} ${point.y} L ${point.x + 3.5} ${point.y} M ${point.x} ${point.y - 3.5} L ${point.x} ${point.y + 3.5}`} />
                <title>{`Marked ${reason}`}</title>
              </g>
            )
          })}
        </g>
      )}

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
