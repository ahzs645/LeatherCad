import { useMemo } from 'react'
import type { LeatherImageFill, LineType, Shape } from '../../cad/cad-types'
import { detectOutlines } from '../../ops/outline-detection'

type CanvasLeatherImageFillLayerProps = {
  leatherImageFills: LeatherImageFill[]
  renderableVisibleShapes: Shape[]
  lineTypesById: Record<string, LineType | undefined>
}

function svgId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function polygonPoints(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

export function CanvasLeatherImageFillLayer({
  leatherImageFills,
  renderableVisibleShapes,
  lineTypesById,
}: CanvasLeatherImageFillLayerProps) {
  const closedOutlines = useMemo(
    () =>
      detectOutlines(
        renderableVisibleShapes,
        Object.values(lineTypesById).filter((lineType): lineType is LineType => lineType !== undefined),
      ).filter((outline) => outline.isClosed && outline.area > 0),
    [renderableVisibleShapes, lineTypesById],
  )
  const visibleFills = leatherImageFills.filter((fill) => fill.visible && fill.assignedShapeIds.length > 0)

  if (visibleFills.length === 0 || closedOutlines.length === 0) {
    return null
  }

  return (
    <g className="canvas-leather-image-fill-layer" style={{ pointerEvents: 'none' }}>
      <defs>
        {visibleFills.flatMap((fill) => {
          const assignedShapeIds = new Set(fill.assignedShapeIds)
          return closedOutlines
            .filter((outline) => outline.shapeIds.some((shapeId) => assignedShapeIds.has(shapeId)))
            .map((outline) => (
              <clipPath key={`${fill.id}-${outline.id}`} id={`leather-fill-${svgId(fill.id)}-${svgId(outline.id)}`}>
                <polygon points={polygonPoints(outline.polygon)} />
              </clipPath>
            ))
        })}
      </defs>

      {visibleFills.flatMap((fill) => {
        const assignedShapeIds = new Set(fill.assignedShapeIds)
        const cx = fill.x + fill.widthMm / 2
        const cy = fill.y + fill.heightMm / 2
        return closedOutlines
          .filter((outline) => outline.shapeIds.some((shapeId) => assignedShapeIds.has(shapeId)))
          .map((outline) => {
            const clipId = `leather-fill-${svgId(fill.id)}-${svgId(outline.id)}`
            return (
              <g key={`${fill.id}-${outline.id}-image`} clipPath={`url(#${clipId})`} opacity={fill.opacity}>
                <g transform={`rotate(${Math.round(fill.rotationDeg * 1000) / 1000} ${cx} ${cy})`}>
                  <svg
                    x={fill.x}
                    y={fill.y}
                    width={fill.widthMm}
                    height={fill.heightMm}
                    viewBox={`${fill.crop.x} ${fill.crop.y} ${fill.crop.width} ${fill.crop.height}`}
                    preserveAspectRatio="none"
                  >
                    <image href={fill.imageDataUrl} x={0} y={0} width={fill.bitmapWidth} height={fill.bitmapHeight} />
                  </svg>
                </g>
              </g>
            )
          })
      })}
    </g>
  )
}
