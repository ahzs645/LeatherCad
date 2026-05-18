import type { PointerEvent } from 'react'
import { lineTypeStrokeDasharray, resolveLineTypeStrokeWidthMm } from '../../cad/line-types'
import type {
  FoldLine,
  LineType,
  Shape,
  TextShape,
} from '../../cad/cad-types'
import type { SketchWorkspaceMode, PiecePlacementGuide } from '../../editor-types'
import type { HandlePointKey } from '../../hooks/useCanvasInteractions'
import { renderCanvasShape } from './canvas-shape-rendering'
import { shapeHandleEntries } from './canvas-geometry'

type CanvasShapeLayerProps = {
  renderableLinkedShapes: Shape[]
  renderableVisibleShapes: Shape[]
  previewShapeIdSet: Set<string>
  selectedShapeIdSet: Set<string>
  lineTypesById: Record<string, LineType | undefined>
  sketchWorkspaceMode: SketchWorkspaceMode
  resolveShapeStrokeColor: (shape: Shape) => string
  shapeStrokeOpacity: number
  /** When set, shapes whose layerId differs are dimmed to emphasise the active layer. */
  highlightActiveLayerId?: string | null
  onShapePointerDown: (event: PointerEvent<SVGElement>, shapeId: string) => void
  previewShapes: Shape[]
  showShapeHandles: boolean
  onShapeHandlePointerDown: (
    event: PointerEvent<SVGCircleElement>,
    shapeId: string,
    pointKey: HandlePointKey,
  ) => void
  onShapeHandleDoubleClick?: (shapeId: string, pointKey: HandlePointKey) => void
  renderableFoldLines: FoldLine[]
  renderablePieceGrainlineSegments: Array<{ pieceId: string; start: import('../../cad/cad-types').Point; end: import('../../cad/cad-types').Point }>
  renderablePieceNotchLines: Array<{ id: string; pieceId: string; start: import('../../cad/cad-types').Point; end: import('../../cad/cad-types').Point; showOnSeam: boolean }>
  renderablePlacementGuides: PiecePlacementGuide[]
  viewportScale: number
  buildTextGlyphPlacements: (shape: TextShape) => Array<{ x: number; y: number; rotationDeg: number; char: string }>
  normalizeTextShape: (shape: TextShape) => TextShape
  textBaselineAngleDeg: (shape: TextShape) => number
}

export function CanvasShapeLayer({
  renderableLinkedShapes,
  renderableVisibleShapes,
  previewShapeIdSet,
  selectedShapeIdSet,
  lineTypesById,
  sketchWorkspaceMode,
  resolveShapeStrokeColor,
  shapeStrokeOpacity,
  highlightActiveLayerId,
  onShapePointerDown,
  previewShapes,
  showShapeHandles,
  onShapeHandlePointerDown,
  onShapeHandleDoubleClick,
  renderableFoldLines,
  renderablePieceGrainlineSegments,
  renderablePieceNotchLines,
  renderablePlacementGuides,
  viewportScale,
  buildTextGlyphPlacements,
  normalizeTextShape,
  textBaselineAngleDeg,
}: CanvasShapeLayerProps) {
  return (
    <>
      <g className="canvas-linked-geometry-layer">
        {renderableLinkedShapes.map((shape) => {
          const lineType = lineTypesById[shape.lineTypeId]
          const layerStroke = resolveShapeStrokeColor(shape)
          const strokeDasharray = sketchWorkspaceMode === 'sketch' ? '8 5' : lineTypeStrokeDasharray(lineType?.style ?? 'solid')
          const linkedClassName = shape.type === 'text'
            ? 'annotation-label text-shape'
            : sketchWorkspaceMode === 'sketch'
              ? 'shape-line shape-linked-reference'
              : 'shape-line shape-linked-assembly'

          return renderCanvasShape(shape, {
            key: shape.id,
            className: linkedClassName,
            color: layerStroke,
            strokeDasharray,
            opacity: shape.type === 'text' ? 0.7 : shapeStrokeOpacity,
            interactive: false,
            onShapePointerDown,
            buildTextGlyphPlacements,
            normalizeTextShape,
            textBaselineAngleDeg,
            strokeWidthMm: resolveLineTypeStrokeWidthMm(lineType),
            viewportScale,
          })
        })}
      </g>

      <g className="canvas-editable-geometry-layer">
        {renderableVisibleShapes.map((shape) => {
          const lineType = lineTypesById[shape.lineTypeId]
          const isSelected = selectedShapeIdSet.has(shape.id)
          const isPreviewSource = previewShapeIdSet.has(shape.id)
          const layerStroke = resolveShapeStrokeColor(shape)
          const strokeDasharray = lineTypeStrokeDasharray(lineType?.style ?? 'solid')
          const className = shape.type === 'text'
            ? `${isSelected ? 'annotation-label text-shape text-shape-selected' : 'annotation-label text-shape'}${isPreviewSource ? ' shape-preview-source' : ''}`
            : `${isSelected ? 'shape-line shape-selected' : 'shape-line'}${isPreviewSource ? ' shape-preview-source' : ''}`

          // Source v? `chkHighlightActiveLayer` — dim shapes on other layers.
          const isOffActiveLayer =
            highlightActiveLayerId !== undefined &&
            highlightActiveLayerId !== null &&
            shape.layerId !== highlightActiveLayerId
          const dimmedOpacity = Math.min(shapeStrokeOpacity, 0.35)
          const effectiveOpacity = isPreviewSource
            ? Math.min(shapeStrokeOpacity, 0.2)
            : isOffActiveLayer
              ? dimmedOpacity
              : shapeStrokeOpacity
          return renderCanvasShape(shape, {
            key: shape.id,
            className,
            color: layerStroke,
            strokeDasharray,
            opacity: effectiveOpacity,
            interactive: true,
            onShapePointerDown,
            buildTextGlyphPlacements,
            normalizeTextShape,
            textBaselineAngleDeg,
            strokeWidthMm: resolveLineTypeStrokeWidthMm(lineType),
            viewportScale,
          })
        })}
      </g>

      {showShapeHandles && (
        <g className="canvas-handle-layer">
          {renderableVisibleShapes
            .filter((shape) => selectedShapeIdSet.has(shape.id) && !previewShapeIdSet.has(shape.id))
            .flatMap((shape) =>
              shapeHandleEntries(shape).map((entry) => (
                <circle
                  key={`${shape.id}-${entry.key}-handle`}
                  cx={entry.point.x}
                  cy={entry.point.y}
                  r={2.3}
                  className="shape-handle"
                  onPointerDown={(event) => onShapeHandlePointerDown(event, shape.id, entry.key)}
                  onDoubleClick={() => onShapeHandleDoubleClick?.(shape.id, entry.key)}
                />
              )),
            )}
          {previewShapes
            .filter((shape) => selectedShapeIdSet.has(shape.id))
            .flatMap((shape) =>
              shapeHandleEntries(shape).map((entry) => (
                <circle
                  key={`${shape.id}-${entry.key}-preview-handle`}
                  cx={entry.point.x}
                  cy={entry.point.y}
                  r={2.3}
                  className="shape-handle shape-handle-preview"
                  onPointerDown={(event) => onShapeHandlePointerDown(event, shape.id, entry.key)}
                  onDoubleClick={() => onShapeHandleDoubleClick?.(shape.id, entry.key)}
                />
              )),
            )}
        </g>
      )}

      {renderableFoldLines.map((foldLine) => (
        <line
          key={foldLine.id}
          x1={foldLine.start.x}
          y1={foldLine.start.y}
          x2={foldLine.end.x}
          y2={foldLine.end.y}
          className="fold-line"
        />
      ))}

      {renderablePieceGrainlineSegments.map((segment) => (
        <g key={`piece-grainline-${segment.pieceId}`} className="piece-grainline" style={{ pointerEvents: 'none' }}>
          <line
            x1={segment.start.x}
            y1={segment.start.y}
            x2={segment.end.x}
            y2={segment.end.y}
            stroke="#0f766e"
            strokeWidth={1.25 / viewportScale}
            strokeDasharray={`${6 / viewportScale} ${4 / viewportScale}`}
          />
          <polyline
            points={`${segment.end.x},${segment.end.y} ${segment.end.x - 3 / viewportScale},${segment.end.y - 1.5 / viewportScale} ${segment.end.x - 3 / viewportScale},${segment.end.y + 1.5 / viewportScale}`}
            fill="none"
            stroke="#0f766e"
            strokeWidth={1.25 / viewportScale}
          />
        </g>
      ))}

      {renderablePieceNotchLines.map((notch) => (
        <line
          key={notch.id}
          x1={notch.start.x}
          y1={notch.start.y}
          x2={notch.end.x}
          y2={notch.end.y}
          stroke={notch.showOnSeam ? '#7c2d12' : '#0f172a'}
          strokeWidth={1.4 / viewportScale}
          style={{ pointerEvents: 'none' }}
        />
      ))}

      {renderablePlacementGuides.map((guide) => {
        const radians = (guide.rotationDeg * Math.PI) / 180
        const halfWidth = guide.widthMm / 2
        const halfHeight = guide.heightMm / 2
        const rotatePoint = (x: number, y: number) => ({
          x: guide.point.x + x * Math.cos(radians) - y * Math.sin(radians),
          y: guide.point.y + x * Math.sin(radians) + y * Math.cos(radians),
        })

        if (guide.kind === 'text') {
          return (
            <text
              key={guide.id}
              x={guide.point.x}
              y={guide.point.y}
              className="annotation-label"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${Math.round(guide.rotationDeg * 1000) / 1000} ${guide.point.x} ${guide.point.y})`}
              style={{ pointerEvents: 'none', fontSize: `${Math.max(4, guide.heightMm)}px` }}
            >
              {guide.text ?? guide.id}
            </text>
          )
        }

        if (guide.kind === 'circle') {
          return (
            <circle
              key={guide.id}
              cx={guide.point.x}
              cy={guide.point.y}
              r={Math.max(1, halfWidth)}
              stroke="#1d4ed8"
              fill="none"
              strokeWidth={1.2 / viewportScale}
              style={{ pointerEvents: 'none' }}
            />
          )
        }

        if (guide.kind === 'box') {
          const corners = [
            rotatePoint(-halfWidth, -halfHeight),
            rotatePoint(halfWidth, -halfHeight),
            rotatePoint(halfWidth, halfHeight),
            rotatePoint(-halfWidth, halfHeight),
          ]
          return (
            <polygon
              key={guide.id}
              points={corners.map((point) => `${point.x},${point.y}`).join(' ')}
              stroke="#1d4ed8"
              fill="none"
              strokeWidth={1.2 / viewportScale}
              style={{ pointerEvents: 'none' }}
            />
          )
        }

        const horizontalStart = rotatePoint(-halfWidth, 0)
        const horizontalEnd = rotatePoint(halfWidth, 0)
        const verticalStart = rotatePoint(0, -halfHeight)
        const verticalEnd = rotatePoint(0, halfHeight)
        return (
          <g key={guide.id} style={{ pointerEvents: 'none' }}>
            <line
              x1={horizontalStart.x}
              y1={horizontalStart.y}
              x2={horizontalEnd.x}
              y2={horizontalEnd.y}
              stroke="#1d4ed8"
              strokeWidth={1.2 / viewportScale}
            />
            <line
              x1={verticalStart.x}
              y1={verticalStart.y}
              x2={verticalEnd.x}
              y2={verticalEnd.y}
              stroke="#1d4ed8"
              strokeWidth={1.2 / viewportScale}
            />
          </g>
        )
      })}
    </>
  )
}
